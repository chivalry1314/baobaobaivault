import CreatorClientPage from "./creator-client-page";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ tenantCode: string }>;
}) {
  const { tenantCode } = await params;
  return <CreatorClientPage tenantCode={tenantCode.trim().toLowerCase()} />;
}
