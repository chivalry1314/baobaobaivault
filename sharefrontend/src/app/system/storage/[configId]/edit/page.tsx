import { ShareSystemStorageEditPage } from "@/components/share/system-storage";

export default async function SystemStorageEditPage(props: {
  params: Promise<{ configId: string }>;
}) {
  const { configId } = await props.params;
  return <ShareSystemStorageEditPage storageConfigID={configId} />;
}
