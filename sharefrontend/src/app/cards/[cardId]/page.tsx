import CardDetailClientPage from "@/components/share/card-detail";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  return <CardDetailClientPage cardId={cardId} />;
}
