import type { ExternalSessionUser } from "@/lib/shared";

export type AccountEntryState = {
  user: ExternalSessionUser | null;
  sessionResolved: boolean;
  navigating: boolean;
};
