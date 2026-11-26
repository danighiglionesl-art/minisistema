import PublicAcademiasPortal from "@/components/academias/PublicAcademiasPortal";

export const dynamic = "force-dynamic";

export default async function PublicAcademiasPage(context: {
  searchParams: Promise<{ cert?: string }>;
}) {
  const sp = await context.searchParams;
  return (
    <PublicAcademiasPortal
      apiEndpoint="/sistema/api/academias"
      initialCertCode={sp?.cert || ""}
    />
  );
}
