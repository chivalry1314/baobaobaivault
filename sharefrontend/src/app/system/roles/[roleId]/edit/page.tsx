import { ShareSystemRoleEditPage } from "@/components/share/system-roles";

export default async function SystemRoleEditPage(props: {
  params: Promise<{ roleId: string }>;
}) {
  await props.params;
  return <ShareSystemRoleEditPage />;
}
