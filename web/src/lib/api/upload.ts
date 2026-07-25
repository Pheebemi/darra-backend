// Direct-to-R2 product file upload.
//
// The file bytes can't go through the Next.js proxy (Vercel serverless has a
// hard 4.5MB request-body limit), so we ask the backend for a short-lived
// presigned URL and PUT the file straight to Cloudflare R2. Only tiny JSON
// messages travel through the proxy.
//
// Returns the storage key to pass as `file_key` on product create/update.
// Returns null when the server has no R2 configured (local dev) so the caller
// can fall back to a normal multipart upload.

export async function uploadProductFileToR2(
  file: File,
  productType: string,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  const presignRes = await fetch("/api/seller/products/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      product_type: productType,
    }),
  });

  // R2 not configured on this server → signal the caller to fall back.
  if (presignRes.status === 503) return null;

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.message || "Could not start the file upload.");
  }

  const { url, key } = await presignRes.json();
  await putToR2(url, file, onProgress);
  return key;
}

function putToR2(
  url: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));

    xhr.send(file);
  });
}
