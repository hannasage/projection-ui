export const socialPreview = {
  title: 'Projection UI · Yes. Another UI library.',
  description: 'React components, glass morphism, and themes.',
  image: 'https://projectionui.dev/social/projection-ui.png',
  width: 1200,
  height: 630,
  alt: 'Projection UI: Yes. Another UI library. A glass project card with themed controls and setup progress.',
};

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, character => ({
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
  })[character]!);
}
