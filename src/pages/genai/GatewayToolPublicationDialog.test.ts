import {describe, expect, it} from 'vitest';
import {publicationScope, type PublishableTool} from './gatewayToolPublicationScope';

const endpoint = (toolId: string, apiVersionId: string): PublishableTool => ({
  toolId,
  name: `endpoint-${toolId}`,
  endpointId: `endpoint-${toolId}`,
  apiVersionId,
});

describe('Gateway Tool publication scope', () => {
  it('replaces only the selected API scope when every Tool belongs to one API version', () => {
    expect(publicationScope([
      endpoint('one', 'api-version-a'),
      endpoint('two', 'api-version-a'),
    ])).toEqual({mode: 'REPLACE_API_SCOPE', apiVersionId: 'api-version-a'});
  });

  it('merges endpoint Tools selected across API versions', () => {
    expect(publicationScope([
      endpoint('one', 'api-version-a'),
      endpoint('two', 'api-version-b'),
    ])).toEqual({mode: 'ADD_OR_UPDATE', apiVersionId: undefined});
  });

  it('merges selections containing workflow-backed Tools', () => {
    expect(publicationScope([
      endpoint('one', 'api-version-a'),
      {toolId: 'workflow', name: 'workflow', executionPlacement: 'workflow'},
    ])).toEqual({mode: 'ADD_OR_UPDATE', apiVersionId: undefined});
  });
});
