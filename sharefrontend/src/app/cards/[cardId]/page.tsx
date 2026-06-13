import CardDetailClientPage from "@/components/share/card-detail";
import { getServerCardDetail } from "@/lib/server-share-api";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const initialDetail = await getServerCardDetail(cardId);

  return (
    <CardDetailClientPage cardId={cardId} initialDetail={initialDetail} />
  );
}
