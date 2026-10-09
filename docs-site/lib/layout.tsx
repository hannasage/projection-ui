import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: 'Projection UI' },
  themeSwitch: { enabled: true },
  links: [
    { text: 'Gallery', url: '/examples/?path=/story/gallery-components--paired' },
    { text: 'Storybook', url: '/examples/' },
    { text: 'GitHub', url: 'https://github.com/hannasage/projection-ui', external: true },
    { text: 'Markdown', url: '/llms.txt' },
  ],
};
