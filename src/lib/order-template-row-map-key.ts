export function getTemplateRowMapKey(template: { template_key: string; audience: string }) {
  return `${template.template_key}:${template.audience}`;
}
