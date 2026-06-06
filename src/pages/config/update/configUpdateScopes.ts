export type ConfigUpdateScopeId = 'instance' | 'api' | 'app' | 'appApi';

export type ConfigUpdateScope = {
  id: ConfigUpdateScopeId;
  label: string;
  targetKeys: Array<'instanceId' | 'instanceApiId' | 'instanceAppId'>;
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
  return value === 'instance' || value === 'api' || value === 'app' || value === 'appApi';
}

export function targetLabel(key: string) {
  return key
    .replace(/Id$/, ' ID')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}
