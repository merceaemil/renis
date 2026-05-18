import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient(endpointOverride?: string) {
  const endpoint =
    endpointOverride ?? process.env.MINIO_ENDPOINT ?? "http://minio:9000";
  return new S3Client({
    endpoint,
    region: process.env.MINIO_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER ?? "minioadmin",
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
    },
    forcePathStyle: true,
  });
}

export function getMinioBucket() {
  return process.env.MINIO_BUCKET ?? "renis-documents";
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getMinioBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

function contentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

/** Fetch object bytes via internal MinIO endpoint (server-side). */
export async function getObjectBuffer(
  key: string
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const client = getClient();
    const res = await client.send(
      new GetObjectCommand({ Bucket: getMinioBucket(), Key: key })
    );
    if (!res.Body) return null;
    const body = Buffer.from(await res.Body.transformToByteArray());
    return {
      body,
      contentType: res.ContentType ?? contentTypeFromKey(key),
    };
  } catch {
    return null;
  }
}

/** Inline data URL for HTML/PDF (Puppeteer cannot reach browser-facing signed URLs). */
export async function getObjectDataUrl(key: string): Promise<string | null> {
  const obj = await getObjectBuffer(key);
  if (!obj) return null;
  return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const publicEndpoint =
    process.env.MINIO_PUBLIC_ENDPOINT ??
    process.env.MINIO_ENDPOINT ??
    "http://localhost:9000";
  const client = getClient(publicEndpoint);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getMinioBucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export function diplomaObjectKey(params: {
  institutionId: string;
  graduationYear: number;
  uniqueCode: string;
}): string {
  return `diplomas/${params.institutionId}/${params.graduationYear}/${params.uniqueCode}.pdf`;
}
