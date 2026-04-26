import CardDetailClientPage from "./card-detail-client-page";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  return <CardDetailClientPage cardId={cardId} />;
}
