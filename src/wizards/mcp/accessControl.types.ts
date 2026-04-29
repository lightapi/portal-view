// ─── Types ────────────────────────────────────────────────────────────────────

export type LabelOption = { value: string; label: string };
export type EndpointInfo = { value: string; label: string; endpoint: string; description?: string };
export type FgaType = 'role' | 'group' | 'position' | 'attribute';

export interface EndpointRule {
  hostId: string; endpointId: string; apiId: string; apiVersion: string;
  endpoint: string; ruleType: string; ruleId: string; active: boolean;
}

export interface BasePermission {
  hostId: string; apiVersionId: string; endpointId: string; active: boolean;
  apiId?: string; apiVersion?: string; endpoint?: string;
}
export interface RolePermission      extends BasePermission { roleId: string; }
export interface GroupPermission     extends BasePermission { groupId: string; }
export interface PositionPermission  extends BasePermission { positionId: string; }
export interface AttributePermission extends BasePermission { attributeId: string; attributeValue?: string; }
export type AnyPermission = RolePermission | GroupPermission | PositionPermission | AttributePermission;

// ─── FGA config ───────────────────────────────────────────────────────────────

export interface FgaConfig {
  label: string; service: string;
  queryAction: string; createAction: string; deleteAction: string;
  lookupAction: string; idKey: string; resultKey: string;
  createEntityAction: string; entityIdKey: string; entityDescKey: string;
  entityExtraFields: { key: string; label: string }[];
}

export const FGA: Record<FgaType, FgaConfig> = {
  role:      { label: 'Role',      service: 'role',      queryAction: 'queryRolePermission',      createAction: 'createRolePermission',      deleteAction: 'deleteRolePermission',      lookupAction: 'getRole',           idKey: 'roleId',      resultKey: 'rolePermissions',      createEntityAction: 'createRole',      entityIdKey: 'roleId',      entityDescKey: 'roleDesc',      entityExtraFields: [] },
  group:     { label: 'Group',     service: 'group',     queryAction: 'queryGroupPermission',     createAction: 'createGroupPermission',     deleteAction: 'deleteGroupPermission',     lookupAction: 'getGroupLabel',     idKey: 'groupId',     resultKey: 'groupPermissions',     createEntityAction: 'createGroup',     entityIdKey: 'groupId',     entityDescKey: 'groupDesc',     entityExtraFields: [] },
  position:  { label: 'Position',  service: 'position',  queryAction: 'queryPositionPermission',  createAction: 'createPositionPermission',  deleteAction: 'deletePositionPermission',  lookupAction: 'getPositionLabel',  idKey: 'positionId',  resultKey: 'positionPermissions',  createEntityAction: 'createPosition',  entityIdKey: 'positionId',  entityDescKey: 'positionDesc',  entityExtraFields: [] },
  attribute: { label: 'Attribute', service: 'attribute', queryAction: 'queryAttributePermission', createAction: 'createAttributePermission', deleteAction: 'deleteAttributePermission', lookupAction: 'getAttributeLabel', idKey: 'attributeId', resultKey: 'attributePermissions', createEntityAction: 'createAttribute', entityIdKey: 'attributeId', entityDescKey: 'attributeDesc', entityExtraFields: [{ key: 'attributeType', label: 'Attribute Type' }] },
};

export const FGA_TYPES: FgaType[] = ['role', 'group', 'position', 'attribute'];
