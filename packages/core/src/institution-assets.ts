import { getObjectDataUrl, getSignedDownloadUrl } from "./minio";

export type InstitutionBrandingKeys = {
  logoObjectKey: string | null;
  signatureInstitutionObjectKey: string | null;
  signatureMinistryObjectKey: string | null;
};

export type InstitutionBrandingUrls = {
  logoUrl: string | null;
  signatureInstitutionUrl: string | null;
  signatureMinistryUrl: string | null;
};

export async function resolveInstitutionBrandingUrls(
  keys: InstitutionBrandingKeys,
  expiresInSeconds = 3600
): Promise<InstitutionBrandingUrls> {
  const resolve = async (key: string | null) => {
    if (!key) return null;
    try {
      return await getSignedDownloadUrl(key, expiresInSeconds);
    } catch {
      return null;
    }
  };

  return {
    logoUrl: await resolve(keys.logoObjectKey),
    signatureInstitutionUrl: await resolve(keys.signatureInstitutionObjectKey),
    signatureMinistryUrl: await resolve(keys.signatureMinistryObjectKey),
  };
}

/** Data URLs for PDF/HTML rendering (embedded in document, no HTTP fetch). */
export async function resolveInstitutionBrandingDataUrls(
  keys: InstitutionBrandingKeys
): Promise<InstitutionBrandingUrls> {
  const resolve = (key: string | null) =>
    key ? getObjectDataUrl(key) : Promise.resolve(null);

  return {
    logoUrl: await resolve(keys.logoObjectKey),
    signatureInstitutionUrl: await resolve(keys.signatureInstitutionObjectKey),
    signatureMinistryUrl: await resolve(keys.signatureMinistryObjectKey),
  };
}

export function institutionAssetKey(
  institutionId: string,
  asset: "logo" | "signature-institution" | "signature-ministry",
  ext: string
): string {
  return `institutions/${institutionId}/${asset}.${ext.replace(/^\./, "")}`;
}
