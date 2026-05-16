export const TOOL_CATEGORIES = ['jardin', 'placo', 'electricite', 'bois', 'eau'] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export function isToolCategory(value: string): value is ToolCategory {
  return TOOL_CATEGORIES.includes(value as ToolCategory);
}
