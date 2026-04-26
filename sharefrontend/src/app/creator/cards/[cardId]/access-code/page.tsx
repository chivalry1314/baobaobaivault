import { ShareCardAccessCode } from "@/components/share/share-card-access-code";

export default async function CreatorCardAccessCodePage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;

  return <ShareCardAccessCode cardId={cardId} />;
}
