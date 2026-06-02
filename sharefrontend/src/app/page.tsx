import { DISCOVER_PAGE_SIZE } from "@/components/share/discover-home/constants";
import { DiscoverHome } from "@/components/share/discover-home";
import { getServerDiscoverCards } from "@/lib/server-share-api";

export default async function LandingPage() {
  const initialDiscover = await getServerDiscoverCards({
    page: 1,
    size: DISCOVER_PAGE_SIZE,
  });

  return <DiscoverHome initialDiscover={initialDiscover} />;
}
