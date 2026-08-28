import { describe, expect, it } from 'vitest';
import { pipelineLoadErrorMessage, platformLoadErrorMessage } from './deploymentLoadErrorMessage';

describe('platformLoadErrorMessage', () => {
  it('explains the required host roles for an access-control denial', () => {
    expect(platformLoadErrorMessage(
      'HTTP 403 Forbidden: Access denied by access control rule for lightapi.net/deployment/getPlatform/0.1.0',
    )).toBe(
      'Access denied. Platform Admin requires the admin, deployment-admin, or deployment-viewer role on the selected host. Sign out and back in after the role is granted.',
    );
  });

  it('identifies Pipeline Admin when its request is denied', () => {
    expect(pipelineLoadErrorMessage(
      'HTTP 403 Forbidden: Access denied by access control rule for lightapi.net/deployment/getPipeline/0.1.0',
    )).toBe(
      'Access denied. Pipeline Admin requires the admin, deployment-admin, or deployment-viewer role on the selected host. Sign out and back in after the role is granted.',
    );
  });

  it('preserves a structured server error description', () => {
    expect(platformLoadErrorMessage({ error: { description: 'Database query timed out' } }))
      .toBe('Unable to load platforms: Database query timed out');
  });

  it('provides a stable fallback when no server detail is available', () => {
    expect(platformLoadErrorMessage({}))
      .toBe('Unable to load platforms. The server did not provide an error message.');
  });
});
