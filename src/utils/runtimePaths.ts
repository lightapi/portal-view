import { getPortalConfig } from "../runtimeConfig/store";

export function joinBrowserPath(base: string, path: string): string {
  const segments = [...base.split("/"), ...path.split("/")].filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Path must not contain dot segments");
  }
  return "/" + segments.join("/");
}

export function joinApiPath(apiBasePath: string, endpoint: string): string {
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new Error("API endpoint must begin with a single slash");
  }
  const queryIndex = endpoint.indexOf("?");
  const path = queryIndex === -1 ? endpoint : endpoint.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : endpoint.slice(queryIndex);
  return joinBrowserPath(apiBasePath, path) + query;
}

export function apiUrl(endpoint: string): string {
  if (/^https?:/i.test(endpoint)) {
    throw new Error("BFF API endpoints must be same-origin paths");
  }
  return new URL(joinApiPath(getPortalConfig().routing.apiBasePath, endpoint), window.location.origin).toString();
}

export function apiWebSocketUrl(endpoint: string): string {
  const url = new URL(apiUrl(endpoint));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function browserRedirectUri(explicit?: string): string {
  if (explicit) return explicit;
  return new URL(joinBrowserPath(getPortalConfig().routing.publicBasePath, "/redirect"), window.location.origin).toString();
}
