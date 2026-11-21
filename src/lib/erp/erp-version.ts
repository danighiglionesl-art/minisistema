export const ERP_ASSET_MAJOR = "321";
export const ERP_ASSET_MINOR = "2";

export function getErpDeploySha(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    ""
  )
    .trim()
    .slice(0, 7);
}

export function getErpAssetVersion(_templateMajor?: string): string {
  const sha = getErpDeploySha();
  return sha
    ? `${ERP_ASSET_MAJOR}.${ERP_ASSET_MINOR}-${sha}`
    : `${ERP_ASSET_MAJOR}.${ERP_ASSET_MINOR}`;
}

export function getErpAppVersion(_templateMajor?: string): string {
  return `minisistema-erp-v${getErpAssetVersion()}`;
}
