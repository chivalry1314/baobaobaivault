import { ShareCardEditor } from "@/components/share/share-card-editor";

export default async function CreatorCardEditPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;

  return <ShareCardEditor mode="edit" cardId={cardId} />;
}
