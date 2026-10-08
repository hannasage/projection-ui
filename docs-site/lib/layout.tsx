import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: 'Projection UI' },
  themeSwitch: { enabled: false },
  links: [
    { text: 'Examples', url: '/examples/' },
    { text: 'GitHub', url: 'https://github.com/hannasage/projection-ui', external: true },
    { text: 'Markdown', url: '/llms.txt' },
  ],
};
