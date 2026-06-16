import { DiscoverHome } from "@/components/share/discover-home";
import { getServerDiscoverCards } from "@/lib/server-share-api";

export const revalidate = 10;

export default async function LandingPage() {
  const data = await getServerDiscoverCards({ page: 1, size: 8 });
  const initialDiscover = data
    ? {
        cards: data.cards,
        pagination: data.pagination,
      }
    : null;

  return <DiscoverHome initialDiscover={initialDiscover} />;
}
