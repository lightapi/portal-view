import { buildTaskAwareRoute } from '../../tasks/taskUtils';
import type { TaskResolvedContext } from '../../tasks/types';
import type { ConfigUpdateScopeId } from './update/configUpdateScopes';

export function buildConfigUpdateRoute(
  scope: ConfigUpdateScopeId,
  searchParams: URLSearchParams,
  context: TaskResolvedContext,
) {
  const baseRoute = buildTaskAwareRoute('/app/config/update', searchParams, context);
  const [path, query = ''] = baseRoute.split('?');
  const nextParams = new URLSearchParams(query);

  nextParams.set('scope', scope);
  if (nextParams.get('task') === 'manage-configuration') {
    nextParams.set('taskStep', 'instance-api');
  }

  if (context.environment) nextParams.set('environment', context.environment);
  if (context.productId) nextParams.set('productId', context.productId);
  if (context.productVersionId) nextParams.set('productVersionId', context.productVersionId);
  if (context.instanceId) nextParams.set('instanceId', context.instanceId);
  if (context.instanceApiId) nextParams.set('instanceApiId', context.instanceApiId);
  if (context.instanceAppId) nextParams.set('instanceAppId', context.instanceAppId);

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}
