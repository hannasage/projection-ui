import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '/src/components/ThemeProvider.tsx';
import {Button} from '/src/components/Button.tsx';
import {Input} from '/src/components/forms/Input.tsx';
import {Select} from '/src/components/forms/Select.tsx';
import {Textarea} from '/src/components/forms/Textarea.tsx';
import {LinkButton} from '/src/components/Content.tsx';
import {Modal} from '/src/components/Modal.tsx';
import {PROJECTION_THEME, COASTAL_DAY_THEME, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME} from '/src/foundations.ts';
function Example({theme,id,override}) {
  const [clicks,setClicks] = React.useState(0);
  const [open,setOpen] = React.useState(false);
  return React.createElement(ThemeProvider,{theme,'data-case':id,className:id,style:{background:theme.bg,color:theme.text,padding:16,...override}},
    React.createElement('section',{'data-case':id},
      React.createElement('p',null,'Normal reading text'),
      React.createElement(Button,{variant:'danger',type:'button',onClick:()=>setClicks(value=>value+1)},'Delete item'),
      React.createElement(Button,{variant:'danger',type:'button',disabled:true,onClick:()=>setClicks(value=>value+1)},'Disabled delete'),
      React.createElement(Button,{variant:'danger',type:'button',style:{color:'#123456'}},'Custom ink'),
      React.createElement(Input,{label:'Email',error:'Input error'}),
      React.createElement(Select,{label:'Choice',error:'Select error',options:[{value:'a',label:'A'}]}),
      React.createElement(Textarea,{label:'Notes',error:'Textarea error'}),
      React.createElement(LinkButton,{variant:'danger',href:'#details'},'Danger link'),
      React.createElement(Button,{type:'button',onClick:()=>setOpen(true)},'Open danger dialog'),
      React.createElement(Modal,{open,title:'Confirm deletion',onDismiss:()=>setOpen(false),actions:[{label:'Confirm delete',variant:'danger',onClick:()=>{setClicks(value=>value+1);setOpen(false)}},{label:'Disabled action',variant:'danger',disabled:true},{label:'Close dialog',variant:'secondary',onClick:()=>setOpen(false)}]},'Review this action.'),
      React.createElement('output',null,clicks)));
}
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,
 ...[[PROJECTION_THEME,'dark'],[COASTAL_DAY_THEME,'light'],[PROJECTION_FLAT_THEME,'flat-dark'],[COASTAL_DAY_FLAT_THEME,'flat-light']].map(([theme,id])=>React.createElement(Example,{key:id,theme,id})),
 React.createElement(Example,{theme:COASTAL_DAY_THEME,id:'token-override',override:{'--ui-danger-text':'#225588'}})));
`;
const parseColor = value => value.startsWith('color(srgb') ? value.match(/[\d.]+/g).slice(0, 3).map(Number) : value.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255);
function luminance(rgb) { return rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0); }
function contrast(first, second) { const a = luminance(parseColor(first)), b = luminance(parseColor(second)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }

test('danger button ink stays readable in both core appearances and preserves neon borders, live variables, and behavior', async () => {
  const server = await createServer({ configFile: false, root: resolve('.'), server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'danger-button-fixture', resolveId(id) { if (id === 'virtual:danger-button') return '\0virtual:danger-button'; }, load(id) { if (id === '\0virtual:danger-button') return fixture; } }] });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    await page.setContent('<link rel="stylesheet" href="/src/tokens/scoped.css"><style>.ui-button { transition: none !important }</style><main id="root"></main>');
    await page.addScriptTag({ type: 'module', url: '/@id/__x00__virtual:danger-button' });
    await page.locator('[data-case=flat-light]').waitFor();
    for (const id of ['dark', 'light', 'flat-dark', 'flat-light']) {
      const area = page.locator(`[data-case=${id}]`);
      const button = area.getByRole('button', { name: 'Delete item', exact: true });
      const colors = await button.evaluate(node => {
        const style = getComputedStyle(node), provider = node.closest('[data-ui-theme]');
        return { ink: style.color, border: style.borderTopColor, fontSize: style.fontSize, background: getComputedStyle(provider).backgroundColor, reading: getComputedStyle(provider).color };
      });
      assert.equal(colors.fontSize, '12px');
      assert.ok(contrast(colors.ink, colors.background) >= 4.5, `${id} danger text: ${contrast(colors.ink, colors.background)}`);
      assert.ok(contrast(colors.reading, colors.background) >= 4.5, `${id} reading text`);
      const rawDanger = { dark: 'rgb(255, 61, 106)', light: 'rgb(255, 61, 106)', 'flat-dark': 'rgb(255, 82, 82)', 'flat-light': 'rgb(207, 34, 46)' }[id];
      assert.equal(colors.border, rawDanger, `${id} retains its raw danger border`);
      for (const message of ['Input error', 'Select error', 'Textarea error']) {
        const ink = await area.getByText(message, { exact: true }).evaluate(node => getComputedStyle(node).color);
        assert.ok(contrast(ink, colors.background) >= 4.5, `${id} ${message} contrast`);
      }
      const linkInk = await area.getByRole('link', { name: 'Danger link' }).evaluate(node => getComputedStyle(node).color);
      assert.ok(contrast(linkInk, colors.background) >= 4.5, `${id} danger link contrast`);
      if (id.includes('dark')) assert.equal(colors.ink, colors.border, 'dark danger ink must retain the existing palette');
      await button.click();
      assert.equal(await area.locator('output').textContent(), '1');
      const disabled = area.getByRole('button', { name: 'Disabled delete', exact: true });
      assert.equal(await disabled.isDisabled(), true);
      await disabled.evaluate(node => node.click());
      assert.equal(await area.locator('output').textContent(), '1');
      assert.equal(await disabled.evaluate(node => getComputedStyle(node).opacity), '0.45');
      assert.equal(await area.getByRole('button', { name: 'Custom ink' }).evaluate(node => getComputedStyle(node).color), 'rgb(18, 52, 86)');
      await area.getByRole('button', { name: 'Open danger dialog' }).click();
      const dialog = area.getByRole('dialog');
      const confirmation = dialog.getByRole('button', { name: 'Confirm delete' });
      const dialogInk = await confirmation.evaluate(node => getComputedStyle(node).color);
      assert.ok(contrast(dialogInk, colors.background) >= 4.5, `${id} modal danger action contrast`);
      assert.equal(await dialog.getByRole('button', { name: 'Disabled action' }).isDisabled(), true);
      await confirmation.click();
      assert.equal(await area.locator('output').textContent(), '2');
      await button.evaluate(node => node.closest('[data-ui-theme]').style.setProperty('--ui-danger', '#FF7755'));
      const changed = await button.evaluate(node => ({ ink: getComputedStyle(node).color, border: getComputedStyle(node).borderTopColor }));
      assert.notEqual(changed.ink, colors.ink, 'derived ink must react to live danger variable changes');
      assert.equal(changed.border, 'rgb(255, 119, 85)');
    }
    const overridden = page.locator('[data-case=token-override]').getByRole('button', { name: 'Delete item', exact: true });
    assert.equal(await overridden.evaluate(node => getComputedStyle(node).color), 'rgb(34, 85, 136)', 'consumer provider token overrides must win');
  } finally {
    await browser?.close();
    await server.close();
  }
});
