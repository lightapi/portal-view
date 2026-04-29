export interface UserState {
  host?: string;
  userId?: string;
}

export type Option = { value: string; label: string };

export type CreateApiForm = {
  hostId: string;
  apiId: string;
  apiName: string;
  apiDesc: string;
  operationOwner: string;
  deliveryOwner: string;
  region: string;
  businessGroup: string;
  lob: string;
  platform: string;
  capability: string;
  gitRepo: string;
  apiStatus: string;
  apiTags: string[];
};

export const EMPTY_CREATE_API_FORM: CreateApiForm = {
  hostId: '',
  apiId: '',
  apiName: '',
  apiDesc: '',
  operationOwner: '',
  deliveryOwner: '',
  region: '',
  businessGroup: '',
  lob: '',
  platform: '',
  capability: '',
  gitRepo: '',
  apiStatus: '',
  apiTags: [],
};

export type CreateApiVersionForm = {
  apiVersion: string;
  apiType: string;
  serviceId: string;
  apiVersionDesc: string;
  specLink: string;
  spec: string;
  transportConfig: string;
  protocol: string;
  envTag: string;
  targetHost: string;
};

export const EMPTY_CREATE_API_VERSION_FORM: CreateApiVersionForm = {
  apiVersion: '',
  apiType: '',
  serviceId: '',
  apiVersionDesc: '',
  specLink: '',
  spec: '',
  transportConfig: '{"transport": "streamable http", "url": "https://lightapi.net/mcp"}',
  protocol: 'https',
  envTag: '',
  targetHost: '',
};

export type McpToolType = {
  name: string;
  endpointId?: string;
  endpoint: string;
  method?: string;
  path?: string;
  description: string;
  inputSchema?: string;
  toolMetadata?: string;
  selected: boolean;
};

export type McpToolsMeta = {
  propertyId: string | null;
  configId: string | null;
  aggregateVersion: number;
  exists: boolean;
};
