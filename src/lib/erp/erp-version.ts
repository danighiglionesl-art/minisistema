export const ERP_ASSET_MAJOR = "318";
export const ERP_ASSET_MINOR = "1";

export function getErpDeploySha(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    ""
  )
    .trim()
    .slice(0, 7);
}

export function getErpAssetVersion(templateMajor?: string): string {
  const major = String(templateMajor || ERP_ASSET_MAJOR).trim() || ERP_ASSET_MAJOR;
  const sha = getErpDeploySha();
  return sha ? `${major}.${ERP_ASSET_MINOR}-${sha}` : `${major}.${ERP_ASSET_MINOR}`;
}

export function getErpAppVersion(templateMajor?: string): string {
  return `minisistema-erp-v${getErpAssetVersion(templateMajor)}`;
}
