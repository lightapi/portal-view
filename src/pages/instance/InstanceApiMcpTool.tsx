import { Navigate, useLocation } from 'react-router-dom';

/**
 * Compatibility route for old bookmarks and task links. Gateway Tool
 * publication is authored only from the Tool catalog now.
 */
export default function InstanceApiMcpTool() {
  const location = useLocation();
  const state = location.state as {data?: {apiVersionId?: string}} | null;
  const current = new URLSearchParams(location.search);
  const apiVersionId = state?.data?.apiVersionId ?? current.get('apiVersionId');
  if (apiVersionId) current.set('apiVersionId', apiVersionId);

  const search = current.toString();
  return <Navigate replace to={`/app/genai/Tool${search ? `?${search}` : ''}`} state={location.state} />;
}
