import { ShareCardEditor } from "@/components/share/card-editor";
import type { ShareCreatorCenterProps } from "@/components/share/creator-center/types";

export function ShareCreatorCenter({ mode = "create" }: ShareCreatorCenterProps) {
  return <ShareCardEditor mode={mode} />;
}
