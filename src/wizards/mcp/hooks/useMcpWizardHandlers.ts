import { apiPost } from '../../../api/apiPost';
import fetchClient from '../../../utils/fetchClient';
import type { McpWizardState } from './useMcpWizardState';
import type { CreateApiForm, CreateApiVersionForm } from '../types';

/**
 * All submit + navigation handlers for the MCP wizard.
 * Reads from and writes to the state bag returned by useMcpWizardState.
 */
export function useMcpWizardHandlers(state: McpWizardState) {
  const {
    navigate,
    host, userId,
    step, setStep,
    advance, setCreationType,
    form, apiErrors, setApiErrors,
    apiAggregateVersion, setApiAggregateVersion,
    committedApiId, setCommittedApiId,
    versionForm, setVersionErrors,
    versionAggregateVersion, setVersionAggregateVersion,
    committedApiVersionId, setCommittedApiVersionId,
    selectedInstanceId,
    committedInstanceApiId, setCommittedInstanceApiId,
    existingApiSelection,
    mcpMeta, selectedMcpTools,
    setToolsCommitted,
    setSubmitting, setSubmitError,
    patch,
    creationType,
  } = state;

  const validateApi = (): boolean => {
    const errs: Partial<Record<keyof CreateApiForm, string>> = {};
    if (!form.apiId.trim()) errs.apiId = 'API ID is required';
    if (!form.apiName.trim()) errs.apiName = 'API Name is required';
    if (!form.apiStatus) errs.apiStatus = 'API Status is required';
    setApiErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateVersion = (): boolean => {
    const errs: Partial<Record<keyof CreateApiVersionForm, string>> = {};
    if (!versionForm.apiVersion.trim()) errs.apiVersion = 'API Version is required';
    if (!versionForm.apiType) errs.apiType = 'API Type is required';
    if (!versionForm.serviceId.trim()) errs.serviceId = 'Service ID is required';
    setVersionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleExistingApiContinue = () => {
    if (!existingApiSelection) return;
    const { apiId, apiName, apiDesc, apiVersionId, instanceApiId } = existingApiSelection;
    setCommittedApiId(apiId);
    patch({ apiId, ...(apiName && { apiName }), ...(apiDesc && { apiDesc }) });
    setSubmitError(null);
    setCreationType('api-continue');  // use Origin-less flow for existing API continuation
    if (apiVersionId) {
      // Land on Deployment step (step 4) so user always picks centralized vs distributed.
      // Even if the version already has an instance, the user should confirm deployment mode first.
      setCommittedApiVersionId(apiVersionId);
      advance(4);
    } else {
      // No version yet — land on Version step (step 3 in api-continue)
      advance(3);
    }
  };

  const handleCommitApi = async () => {
    if (!validateApi()) return;
    setSubmitting(true);
    setSubmitError(null);

    const isUpdate = !!committedApiId;
    const body = {
      host: 'lightapi.net', service: 'service',
      action: isUpdate ? 'updateApi' : 'createApi', version: '0.1.0',
      data: {
        hostId: host, updateUser: userId,
        apiId: form.apiId.trim(), apiName: form.apiName.trim(),
        ...(form.apiDesc.trim() && { apiDesc: form.apiDesc.trim() }),
        ...(form.operationOwner && { operationOwner: form.operationOwner }),
        ...(form.deliveryOwner && { deliveryOwner: form.deliveryOwner }),
        ...(form.region && { region: form.region }),
        ...(form.businessGroup && { businessGroup: form.businessGroup }),
        ...(form.lob && { lob: form.lob }),
        ...(form.platform && { platform: form.platform }),
        ...(form.capability && { capability: form.capability }),
        ...(form.gitRepo.trim() && { gitRepo: form.gitRepo.trim() }),
        apiStatus: form.apiStatus,
        ...(form.apiTags.length > 0 && { apiTags: form.apiTags.join(',') }),
        ...(isUpdate && { aggregateVersion: apiAggregateVersion }),
      },
    };
    const result = await apiPost({ url: '/portal/command', headers: {}, body });
    setSubmitting(false);
    if (result.error || result.aborted) {
      setSubmitError(result.error
        ? (typeof result.error === 'string' ? result.error : `Failed to ${isUpdate ? 'update' : 'create'} API. Please try again.`)
        : 'Request was cancelled. Please try again.');
      return;
    }
    if (!committedApiId) setCommittedApiId(form.apiId.trim());
    advance();
  };

  const handleCommitVersion = async () => {
    if (!validateVersion()) return;
    setSubmitting(true);
    setSubmitError(null);

    const isUpdate = !!committedApiVersionId;
    const body = {
      host: 'lightapi.net', service: 'service',
      action: isUpdate ? 'updateApiVersion' : 'createApiVersion', version: '0.1.0',
      data: {
        hostId: host, updateUser: userId,
        ...(isUpdate && { apiVersionId: committedApiVersionId, aggregateVersion: versionAggregateVersion }),
        apiId: committedApiId,
        apiVersion: versionForm.apiVersion.trim(),
        apiType: versionForm.apiType,
        serviceId: versionForm.serviceId.trim(),
        ...(versionForm.apiVersionDesc.trim() && { apiVersionDesc: versionForm.apiVersionDesc.trim() }),
        ...(versionForm.specLink.trim() && { specLink: versionForm.specLink.trim() }),
        ...(versionForm.spec.trim() && { spec: versionForm.spec.trim() }),
        ...(versionForm.apiType === 'mcp' && versionForm.transportConfig.trim() && { transportConfig: versionForm.transportConfig.trim() }),
        protocol: versionForm.protocol,
        ...(versionForm.envTag.trim() && { envTag: versionForm.envTag.trim() }),
        ...(versionForm.targetHost.trim() && { targetHost: versionForm.targetHost.trim() }),
      },
    };
    const result = await apiPost({ url: '/portal/command', headers: {}, body });
    if (result.error || result.aborted) {
      setSubmitting(false);
      setSubmitError(result.error
        ? (typeof result.error === 'string' ? result.error : `Failed to ${isUpdate ? 'update' : 'create'} API version. Please try again.`)
        : 'Request was cancelled. Please try again.');
      return;
    }

    if (!isUpdate) {
      const cmdData: any = (result as any)?.data;
      const responseApiVersionId = cmdData?.apiVersionId ?? cmdData?.data?.apiVersionId;
      const responseAggregateVersion = cmdData?.aggregateVersion ?? cmdData?.data?.aggregateVersion;
      if (responseApiVersionId) {
        setCommittedApiVersionId(responseApiVersionId);
        if (typeof responseAggregateVersion === 'number') setVersionAggregateVersion(responseAggregateVersion);
      }
      if (!responseApiVersionId) {
        try {
          const cmd = {
            host: 'lightapi.net', service: 'service', action: 'getApiVersion', version: '0.1.0',
            data: { hostId: host, apiId: committedApiId, offset: 0, limit: 100 },
          };
          const versionData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
          const versions: any[] = Array.isArray(versionData) ? versionData : (versionData?.apiVersions ?? []);
          const match = versions.find((v) => v.apiVersion === versionForm.apiVersion.trim())
            ?? (versions.length === 1 ? versions[0] : undefined);
          setCommittedApiVersionId(match?.apiVersionId ?? '');
          if (match?.aggregateVersion) setVersionAggregateVersion(match.aggregateVersion);
        } catch { /* non-fatal */ }
      }
    }

    setSubmitting(false);
    advance();
  };

  const handleLinkInstance = async () => {
    if (committedInstanceApiId) { advance(); return; }
    if (!selectedInstanceId) {
      setSubmitError('Please select a gateway instance to continue, or click "Skip for now".');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const body = {
      host: 'lightapi.net', service: 'instance', action: 'createInstanceApi', version: '0.1.0',
      data: { hostId: host, updateUser: userId, instanceId: selectedInstanceId, apiVersionId: committedApiVersionId },
    };
    const result = await apiPost({ url: '/portal/command', headers: {}, body });
    if (result.error || result.aborted) {
      setSubmitting(false);
      setSubmitError(result.error
        ? (typeof result.error === 'string' ? result.error : 'Failed to link API to gateway. Please try again.')
        : 'Request was cancelled. Please try again.');
      return;
    }
    try {
      const filters = JSON.stringify([
        { id: 'instanceId', value: selectedInstanceId },
        { id: 'apiVersionId', value: committedApiVersionId },
      ]);
      const cmd = {
        host: 'lightapi.net', service: 'instance', action: 'getInstanceApi', version: '0.1.0',
        data: { hostId: host, offset: 0, limit: 100, active: true, filters, sorting: '[]', globalFilter: '' },
      };
      const instanceApiData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      const instanceApis: any[] = instanceApiData?.instanceApis ?? [];
      const match = instanceApis.find(
        (ia) => ia.instanceId === selectedInstanceId && ia.apiVersionId === committedApiVersionId,
      );
      setCommittedInstanceApiId(match?.instanceApiId ?? '');
    } catch { /* non-fatal */ }
    setSubmitting(false);
    advance();
  };

  const handleSaveMcpTools = async (): Promise<boolean> => {
    if (selectedMcpTools.length === 0) return true;
    if (!mcpMeta.propertyId) {
      setSubmitError('Missing configuration metadata. Please skip this step and configure MCP tools from the Instance admin.');
      return false;
    }
    setSubmitting(true);
    setSubmitError(null);

    const propertyValue = JSON.stringify(
      selectedMcpTools.map((t) => {
        const obj: any = {
          name: t.name, endpoint: t.endpoint, method: t.method, path: t.path,
          description: t.description,
          inputSchema: t.inputSchema ? (() => { try { return JSON.parse(t.inputSchema!); } catch { return t.inputSchema; } })() : undefined,
          toolMetadata: t.toolMetadata ? (() => { try { return JSON.parse(t.toolMetadata!); } catch { return undefined; } })() : undefined,
        };
        return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
      }),
    );

    let body: any;
    if (mcpMeta.exists) {
      body = {
        host: 'lightapi.net', service: 'config', action: 'updateConfigInstanceApi', version: '0.1.0',
        data: { hostId: host, instanceApiId: committedInstanceApiId, propertyId: mcpMeta.propertyId, propertyValue },
      };
    } else {
      if (!mcpMeta.configId) {
        setSubmitError('Missing configuration metadata. Please skip this step and configure MCP tools from the Instance admin.');
        setSubmitting(false);
        return false;
      }
      body = {
        host: 'lightapi.net', service: 'config', action: 'createConfigInstanceApi', version: '0.1.0',
        data: { hostId: host, instanceApiId: committedInstanceApiId, configId: mcpMeta.configId, propertyId: mcpMeta.propertyId, propertyValue },
      };
    }

    const result = await apiPost({ url: '/portal/command', headers: {}, body });
    setSubmitting(false);
    if (result.error || result.aborted) {
      setSubmitError(result.error
        ? (typeof result.error === 'string' ? result.error : 'Failed to save MCP tool configuration. Please try again.')
        : 'Request was cancelled. Please try again.');
      return false;
    }
    return true;
  };

  const advanceFromTools = () => { setToolsCommitted(true); advance(); };

  const handleNext = () => {
    if (step === 0 && !creationType) return;
    advance();
  };

  return {
    handleExistingApiContinue,
    handleCommitApi,
    handleCommitVersion,
    handleLinkInstance,
    handleSaveMcpTools,
    advanceFromTools,
    handleNext,
  };
}
