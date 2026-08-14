import {describe, expect, it} from 'vitest';
import {publicationScope, type PublishableTool} from './gatewayToolPublicationScope';
import {gatewayToolQueryUrl} from './gatewayToolPublicationRpc';

const endpoint = (toolId: string, apiVersionId: string): PublishableTool => ({
  toolId,
  name: `endpoint-${toolId}`,
  endpointId: `endpoint-${toolId}`,
  apiVersionId,
});

describe('Gateway Tool publication scope', () => {
  it('routes instance discovery through the instance service', () => {
    const url = gatewayToolQueryUrl('instance', 'getInstance', {hostId: 'host-a'});
    const command = JSON.parse(new URLSearchParams(url.split('?')[1]).get('cmd')!);

    expect(command).toMatchObject({
      host: 'lightapi.net',
      service: 'instance',
      action: 'getInstance',
      version: '0.1.0',
      data: {hostId: 'host-a'},
    });
  });

  it('keeps publication preview queries on the genai service', () => {
    const url = gatewayToolQueryUrl(
      'genai',
      'getGatewayToolPublicationCandidate',
      {hostId: 'host-a'},
    );
    const command = JSON.parse(new URLSearchParams(url.split('?')[1]).get('cmd')!);

    expect(command).toMatchObject({
      service: 'genai',
      action: 'getGatewayToolPublicationCandidate',
    });
  });

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
