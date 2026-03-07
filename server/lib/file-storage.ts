import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const isConfigured =
  !!process.env.STORAGE_ACCESS_KEY_ID &&
  !!process.env.STORAGE_SECRET_ACCESS_KEY &&
  !!process.env.STORAGE_BUCKET_NAME;

function getClient(): S3Client {
  return new S3Client({
    region: process.env.STORAGE_REGION ?? "auto",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
  });
}

export async function uploadBase64Image(
  base64Data: string,
  folder: string = "receipts"
): Promise<string | null> {
  if (!isConfigured) return null;

  try {
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    const [, mimeType, data] = matches;

    const ext = mimeType.split("/")[1] ?? "jpg";
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(data, "base64");

    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000",
      })
    );

    const publicUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "");
    return publicUrl ? `${publicUrl}/${key}` : null;
  } catch (err) {
    console.error("[file-storage] Upload failed:", err);
    return null;
  }
}

export async function deleteFileByUrl(url: string): Promise<void> {
  if (!isConfigured) return;

  try {
    const publicUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "");
    if (!publicUrl) return;

    const key = url.replace(`${publicUrl}/`, "");
    if (!key || key === url) return;

    const client = getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.STORAGE_BUCKET_NAME!,
        Key: key,
      })
    );
  } catch (err) {
    console.error("[file-storage] Delete failed:", err);
  }
}

export { isConfigured as isStorageConfigured };
