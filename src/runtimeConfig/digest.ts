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
      // Bound each check so a stalled proxy cannot accumulate pending requests.
      signal: AbortSignal.timeout(10_000),
    });
    // Error pages (proxy 5xx, legacy 404) carry their own ETags; they are not drift.
    if (!response.ok) return false;
    const digest = response.headers.get("X-Portal-Config-Digest") ??
      response.headers.get("ETag") ?? "";
    return digest !== "" && digest !== initialConfigDigest;
  } catch {
    return false;
  }
}
