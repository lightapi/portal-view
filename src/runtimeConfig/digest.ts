export let initialConfigDigest = "";

export function setInitialConfigDigest(digest: string): void {
  initialConfigDigest = digest;
}

export async function checkConfigDrift(): Promise<boolean> {
  if (!initialConfigDigest) return false;

  try {
    const response = await fetch(new URL("portal-config.json", document.baseURI), {
      method: "HEAD",
      cache: "no-store",
    });
    const digest = response.headers.get("X-Portal-Config-Digest") ??
      response.headers.get("ETag") ?? "";
    return digest !== "" && digest !== initialConfigDigest;
  } catch {
    return false;
  }
}
