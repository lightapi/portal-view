type PortalService = 'genai' | 'instance';

export function gatewayToolRpc(
  service: PortalService,
  action: string,
  data: Record<string, unknown>,
) {
  return {host: 'lightapi.net', service, action, version: '0.1.0', data};
}

export function gatewayToolQueryUrl(
  service: PortalService,
  action: string,
  data: Record<string, unknown>,
) {
  return '/portal/query?cmd=' + encodeURIComponent(
    JSON.stringify(gatewayToolRpc(service, action, data)),
  );
}
