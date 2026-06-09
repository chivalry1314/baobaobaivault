import { ShareSystemNamespaceEditPage } from "@/components/share/system-namespaces";

export default async function SystemNamespaceEditPage(props: {
  params: Promise<{ namespaceId: string }>;
}) {
  const { namespaceId } = await props.params;
  return <ShareSystemNamespaceEditPage namespaceID={namespaceId} />;
}
