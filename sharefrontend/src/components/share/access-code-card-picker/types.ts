export type ViewMode = "grid" | "list";
export type VisibilityFilter = "all" | "public" | "private";

export type VisibilityFilterOption = {
  value: VisibilityFilter;
  label: string;
  description: string;
};
