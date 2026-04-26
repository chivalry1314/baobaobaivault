import ShopClientPage from "./shop-client-page";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ tenantCode: string }>;
}) {
  const { tenantCode } = await params;
  return <ShopClientPage tenantCode={tenantCode.trim().toLowerCase()} />;
}
