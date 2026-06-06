export type ConfigUpdateScopeId = 'environment' | 'product' | 'productVersion' | 'instance' | 'api' | 'app' | 'appApi';

export type ConfigUpdateTargetKey = 'environment' | 'productId' | 'productVersionId' | 'instanceId' | 'instanceApiId' | 'instanceAppId';

export type ConfigUpdateScope = {
  id: ConfigUpdateScopeId;
  label: string;
  targetKeys: ConfigUpdateTargetKey[];
  createAction: string;
  updateAction: string;
  deleteAction: string;
  getFreshAction: string;
  createForm: string;
  updateForm: string;
  defaultResourceTypes?: string[];
};

export const configUpdateScopes: ConfigUpdateScope[] = [
  {
    id: 'environment',
    label: 'Environment',
    targetKeys: ['environment'],
    createAction: 'createConfigEnvironment',
    updateAction: 'updateConfigEnvironment',
    deleteAction: 'deleteConfigEnvironment',
    getFreshAction: 'getFreshConfigEnvironment',
    createForm: 'createConfigEnvironment',
    updateForm: 'updateConfigEnvironment',
  },
  {
    id: 'product',
    label: 'Product',
    targetKeys: ['productId'],
    createAction: 'createConfigProduct',
    updateAction: 'updateConfigProduct',
    deleteAction: 'deleteConfigProduct',
    getFreshAction: 'getFreshConfigProduct',
    createForm: 'createConfigProduct',
    updateForm: 'updateConfigProduct',
  },
  {
    id: 'productVersion',
    label: 'Product Version',
    targetKeys: ['productVersionId'],
    createAction: 'createConfigProductVersion',
    updateAction: 'updateConfigProductVersion',
    deleteAction: 'deleteConfigProductVersion',
    getFreshAction: 'getFreshConfigProductVersion',
    createForm: 'createConfigProductVersion',
    updateForm: 'updateConfigProductVersion',
  },
  {
    id: 'instance',
    label: 'Instance',
    targetKeys: ['instanceId'],
    createAction: 'createConfigInstance',
    updateAction: 'updateConfigInstance',
    deleteAction: 'deleteConfigInstance',
    getFreshAction: 'getFreshConfigInstance',
    createForm: 'createConfigInstance',
    updateForm: 'updateConfigInstance',
  },
  {
    id: 'api',
    label: 'API',
    targetKeys: ['instanceApiId'],
    createAction: 'createConfigInstanceApi',
    updateAction: 'updateConfigInstanceApi',
    deleteAction: 'deleteConfigInstanceApi',
    getFreshAction: 'getFreshConfigInstanceApi',
    createForm: 'createConfigInstanceApi',
    updateForm: 'updateConfigInstanceApi',
    defaultResourceTypes: ['api', 'api|app_api', 'all'],
  },
  {
    id: 'app',
    label: 'App',
    targetKeys: ['instanceAppId'],
    createAction: 'createConfigInstanceApp',
    updateAction: 'updateConfigInstanceApp',
    deleteAction: 'deleteConfigInstanceApp',
    getFreshAction: 'getFreshConfigInstanceApp',
    createForm: 'createConfigInstanceApp',
    updateForm: 'updateConfigInstanceApp',
    defaultResourceTypes: ['app', 'app|app_api', 'all'],
  },
  {
    id: 'appApi',
    label: 'App API',
    targetKeys: ['instanceAppId', 'instanceApiId'],
    createAction: 'createConfigInstanceAppApi',
    updateAction: 'updateConfigInstanceAppApi',
    deleteAction: 'deleteConfigInstanceAppApi',
    getFreshAction: 'getFreshConfigInstanceAppApi',
    createForm: 'createConfigInstanceAppApi',
    updateForm: 'updateConfigInstanceAppApi',
    defaultResourceTypes: ['app_api', 'api|app_api', 'app|app_api', 'all'],
  },
];

export const scopeById = Object.fromEntries(
  configUpdateScopes.map((scope) => [scope.id, scope]),
) as Record<ConfigUpdateScopeId, ConfigUpdateScope>;

export function isConfigUpdateScopeId(value: string | null | undefined): value is ConfigUpdateScopeId {
  return value === 'environment'
    || value === 'product'
    || value === 'productVersion'
    || value === 'instance'
    || value === 'api'
    || value === 'app'
    || value === 'appApi';
}

export function targetLabel(key: string) {
  return key
    .replace(/Id$/, ' ID')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}
