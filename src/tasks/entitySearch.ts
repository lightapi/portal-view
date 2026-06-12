import fetchClient from "../utils/fetchClient";
import { hasAnyRole } from "../utils/ownershipScope";
import type { TaskResolvedContext } from "./types";

export type EntitySearchResult = {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  context: TaskResolvedContext;
};

type EntitySearchSource = {
  id: string;
  category: string;
  service: string;
  action: string;
  resultKey: string;
  route: string;
  roles?: string[];
  context: (record: Record<string, unknown>, hostId: string) => TaskResolvedContext;
  title: (record: Record<string, unknown>) => string;
  description: (record: Record<string, unknown>) => string;
};

const entitySources: EntitySearchSource[] = [
  {
    id: "api",
    category: "API",
    service: "service",
    action: "getApi",
    resultKey: "services",
    route: "/app/apiDetail",
    roles: ["user"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      apiId: stringValue(record.apiId),
    }),
    title: (record) => stringValue(record.apiName) || stringValue(record.apiId) || "API",
    description: (record) => stringValue(record.apiDesc) || stringValue(record.apiType) || stringValue(record.apiId),
  },
  {
    id: "instance",
    category: "Instance",
    service: "instance",
    action: "getInstance",
    resultKey: "instances",
    route: "/app/instance/InstanceAdmin",
    roles: ["user", "instance-admin"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      instanceId: stringValue(record.instanceId),
      productId: stringValue(record.productId),
      productVersionId: stringValue(record.productVersionId),
      environment: stringValue(record.environment),
    }),
    title: (record) => stringValue(record.instanceName) || stringValue(record.instanceId) || "Instance",
    description: (record) => stringValue(record.instanceDesc) || stringValue(record.resourceName) || stringValue(record.instanceId),
  },
  {
    id: "role",
    category: "Role",
    service: "role",
    action: "getRole",
    resultKey: "roles",
    route: "/app/access/roleAdmin",
    roles: ["admin"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      roleId: stringValue(record.roleId),
    }),
    title: (record) => stringValue(record.roleId) || "Role",
    description: (record) => stringValue(record.roleDesc) || stringValue(record.roleId),
  },
  {
    id: "user",
    category: "User",
    service: "user",
    action: "listUserByHostId",
    resultKey: "users",
    route: "/app/user",
    roles: ["admin"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      userId: stringValue(record.userId),
    }),
    title: (record) => stringValue(record.email) || stringValue(record.userId) || "User",
    description: (record) => stringValue(record.userId) || stringValue(record.email),
  },
  {
    id: "client-app",
    category: "Client App",
    service: "client",
    action: "getApp",
    resultKey: "apps",
    route: "/app/clientApp",
    roles: ["user", "app-admin"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      appId: stringValue(record.appId),
    }),
    title: (record) => stringValue(record.appName) || stringValue(record.appId) || "Client App",
    description: (record) => stringValue(record.appDesc) || stringValue(record.appId),
  },
  {
    id: "oauth-client",
    category: "OAuth Client",
    service: "oauth",
    action: "getClient",
    resultKey: "clients",
    route: "/app/oauth/authClient",
    roles: ["user", "oauth-client-admin"],
    context: (record, hostId) => ({
      hostId: stringValue(record.hostId) || hostId,
      clientId: stringValue(record.clientId),
      appId: stringValue(record.appId),
      apiId: stringValue(record.apiId),
      apiVersionId: stringValue(record.apiVersionId),
      instanceId: stringValue(record.instanceId),
    }),
    title: (record) => stringValue(record.clientName) || stringValue(record.clientId) || "OAuth Client",
    description: (record) => stringValue(record.ownerName) || stringValue(record.clientId),
  },
];

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function canSearchSource(roles: string | null | undefined, requiredRoles?: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (hasAnyRole(roles, ["admin", "host-admin"])) return true;
  return hasAnyRole(roles, requiredRoles);
}

function compactContext(context: TaskResolvedContext) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => !!value),
  ) as TaskResolvedContext;
}

async function searchSource(
  source: EntitySearchSource,
  hostId: string,
  query: string,
  limit: number,
) {
  const cmd = {
    host: "lightapi.net",
    service: source.service,
    action: source.action,
    version: "0.1.0",
    data: {
      hostId,
      offset: 0,
      limit,
      active: true,
      filters: "[]",
      sorting: "[]",
      globalFilter: query,
    },
  };

  const data = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)));
  const records = Array.isArray(data?.[source.resultKey])
    ? data[source.resultKey] as Array<Record<string, unknown>>
    : [];

  return records.map((record, index): EntitySearchResult => {
    const context = compactContext(source.context(record, hostId));
    const stableId = Object.values(context).find((value) => typeof value === "string") ?? String(index);
    return {
      id: `${source.id}:${stableId}`,
      title: source.title(record),
      description: source.description(record),
      category: source.category,
      route: source.route,
      context,
    };
  });
}

export async function searchEntities(
  hostId: string | null | undefined,
  roles: string | null | undefined,
  query: string,
  limitPerSource = 3,
) {
  const normalizedQuery = query.trim();
  if (!hostId || normalizedQuery.length < 2) return [];

  const searches = entitySources
    .filter((source) => canSearchSource(roles, source.roles))
    .map((source) => searchSource(source, hostId, normalizedQuery, limitPerSource));

  const results = await Promise.allSettled(searches);
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
