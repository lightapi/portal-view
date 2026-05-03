import { config } from "../../config";

export const DEFAULT_PORTAL_HELP_PATH = "/help/portal-view/index";

export function normalizeHelpPath(helpPath?: string | null) {
  const trimmed = helpPath?.trim();
  if (!trimmed) return DEFAULT_PORTAL_HELP_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function buildPortalHelpUrl(helpPath?: string | null) {
  const normalizedPath = normalizeHelpPath(helpPath);
  const baseUrl = config.portalDocBaseUrl.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
