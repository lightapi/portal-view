import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../../../authConfig';
import { apiPost } from '../../../api/apiPost';
import fetchClient from '../../../utils/fetchClient';
import {
  isPreRegistrationEnabled,
  preRegistrationApiIdPath,
  preRegistrationServiceIdPath,
  preRegistrationErrorPath,
  preRegistrationUrl,
  preRegistrationPayloadMapping,
  isToolsSyncEnabled,
  toolsSyncUrl,
  toolsSyncErrorPath,
  wizardRequiredApiFields,
} from '../../../../config';
import type { McpWizardState } from './useMcpWizardState';
import type { CreateApiForm, CreateApiVersionForm } from '../types';
import {
  buildToolMetadata,
  validateTargetHost,
  validateToolMetadataInputs,
} from '../../../utils/toolMetadata';

/**
 * All submit + navigation handlers for the MCP wizard.
 * Reads from and writes to the state bag returned by useMcpWizardState.
 */
export function useMcpWizardHandlers(state: McpWizardState) {
  const { instance, accounts } = useMsal();

  const getIdToken = async (): Promise<string | null> => {
    try {
      const allAccounts = accounts.length ? accounts : instance.getAllAccounts();
      if (!allAccounts.length) return null;
      const result = await instance.acquireTokenSilent({ ...loginRequest, account: allAccounts[0] });
      return result.idToken ?? null;
    } catch (err) {
      console.warn('[getIdToken] acquireTokenSilent failed:', err);
      return null;
    }
  };

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
    patch, patchVersion,
    creationType,
    optionLookup,
    preRegisteredApiId, setPreRegisteredApiId,
    preRegisteredServiceId, setPreRegisteredServiceId,
    registrationExternalApiId, setRegistrationExternalApiId,
  } = state;

  const getValueByPath = (obj: unknown, path: string): unknown => {
    const segments = path.split('.').map((s) => s.trim()).filter(Boolean);
    return segments.reduce<unknown>((acc, key) => {
      if (acc == null) return undefined;
      if (Array.isArray(acc)) {
        const idx = Number(key);
        return Number.isInteger(idx) ? acc[idx] : undefined;
      }
      if (typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, obj);
  };

  const resolveApiIdFromPreRegistration = async (): Promise<string> => {
    const endpointUrl = preRegistrationUrl;
    if (!endpointUrl) {
      throw new Error('Missing VITE_PRE_REGISTRATION_URL while pre-registration is enabled.');
    }

    // Build payload from config mapping; resolve IDs/arrays to plain-text labels via option lookup
    const rawForm = form as Record<string, unknown>;
    const registrationPayload: Record<string, unknown> = {};
    for (const [payloadKey, formField] of Object.entries(preRegistrationPayloadMapping)) {
      const raw = rawForm[formField];
      const opts = optionLookup[formField];
      if (Array.isArray(raw)) {
        const labels = opts && opts.length > 0
          ? raw.map((id) => opts.find((o) => o.value === id)?.label ?? id)
          : raw;
        registrationPayload[payloadKey] = labels.map((l: unknown) => String(l).toLowerCase()).join(',');
      } else if (typeof raw === 'string' && raw) {
        registrationPayload[payloadKey] = opts && opts.length > 0
          ? (opts.find((o) => o.value === raw)?.label ?? raw)
          : raw;
      } else if (raw != null) {
        registrationPayload[payloadKey] = raw;
      }
    }

    const idToken = await getIdToken();
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
      },
      body: JSON.stringify(registrationPayload),
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = `Registration request failed (${response.status})`;
      try {
        const errData = await response.json() as Record<string, unknown>;
        const extracted = preRegistrationErrorPath
          ? getValueByPath(errData, preRegistrationErrorPath)
          : (errData.message ?? errData.error ?? errData.detail ?? errData.description);
        if (typeof extracted === 'string' && extracted.trim()) {
          errorMessage = extracted.trim();
        } else {
          const fieldErrors = errData.errors ?? errData.fieldErrors ?? errData.validationErrors;
          if (fieldErrors && typeof fieldErrors === 'object') {
            const parts = Object.entries(fieldErrors as Record<string, unknown>)
              .map(([f, m]) => `${f}: ${m}`)
              .join('; ');
            if (parts) errorMessage = parts;
          }
        }
      } catch { /* response was not JSON — fall back to status text */ }
      throw new Error(errorMessage);
    }

    const data: unknown = await response.json().catch(() => ({}));
    const responsePath = preRegistrationApiIdPath;
    const apiIdValue = getValueByPath(data, responsePath);
    if (typeof apiIdValue !== 'string' || !apiIdValue.trim()) {
      throw new Error(`Registration response did not include a valid API ID at path "${responsePath}".`);
    }

    // Optionally extract serviceId if a path is configured
    if (preRegistrationServiceIdPath) {
      const serviceIdValue = getValueByPath(data, preRegistrationServiceIdPath);
      if (typeof serviceIdValue === 'string' && serviceIdValue.trim()) {
        setPreRegisteredServiceId(serviceIdValue.trim());
        patchVersion({ serviceId: serviceIdValue.trim() });
      }
    }

    // Persist the external registry's apiId for the tools sync endpoint
    setRegistrationExternalApiId(apiIdValue.trim());

    return apiIdValue.trim();
  };

  const validateApi = (): boolean => {
    const apiIdGeneratedByPreRegistration = isPreRegistrationEnabled && !committedApiId;

    const validators: [keyof CreateApiForm, string, () => boolean][] = [
      ['apiId',        'API ID is required',         () => !!form.apiId.trim() || apiIdGeneratedByPreRegistration],
      ['apiName',      'API Name is required',        () => !!form.apiName.trim()],
      ['apiStatus',    'API Status is required',      () => !!form.apiStatus],
      ['categoryIds',  'Category is required',        () => form.categoryIds.length > 0],
      ['apiDesc',      'Description is required',     () => !!form.apiDesc.trim()],
      ['region',       'Region is required',          () => !!form.region],
      ['businessGroup','Business Group is required',  () => !!form.businessGroup],
      ['lob',          'Line of Business is required',() => !!form.lob],
      ['platform',     'Platform is required',        () => !!form.platform],
    ];

    const alwaysRequired: (keyof CreateApiForm)[] = ['apiId', 'apiName', 'apiStatus'];
    const requiredSet = new Set<keyof CreateApiForm>([...alwaysRequired, ...(wizardRequiredApiFields as (keyof CreateApiForm)[])]);

    const errs: Partial<Record<keyof CreateApiForm, string>> = {};
    for (const [field, message, isValid] of validators) {
      if (requiredSet.has(field) && !isValid()) errs[field] = message;
    }

    setApiErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateVersion = (): boolean => {
    const errs: Partial<Record<keyof CreateApiVersionForm, string>> = {};
    if (!versionForm.apiVersion.trim()) errs.apiVersion = 'API Version is required';
    if (!versionForm.apiType) errs.apiType = 'API Type is required';
    if (!versionForm.serviceId.trim()) errs.serviceId = 'Service ID is required';
    const targetHostError = validateTargetHost(versionForm.targetHost);
    if (targetHostError) errs.targetHost = targetHostError;
    setVersionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleExistingApiContinue = () => {
    if (!existingApiSelection) return;
    const { apiId, apiName, apiDesc, apiVersionId } = existingApiSelection;
    setCommittedApiId(apiId);
    patch({ apiId, ...(apiName && { apiName }), ...(apiDesc && { apiDesc }) });
    setSubmitError(null);
    if (creationType === 'onboard') {
      if (apiVersionId) {
        setCommittedApiVersionId(apiVersionId);
        advance(2);
      }
      return;
    }
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

    const shouldPreRegister = isPreRegistrationEnabled && !committedApiId;

    // Phase 1 — fire pre-registration and hold for user confirmation
    if (shouldPreRegister && !preRegisteredApiId) {
      try {
        const generatedId = await resolveApiIdFromPreRegistration();
        setPreRegisteredApiId(generatedId);
        patch({ apiId: generatedId });
        setSubmitting(false);
        return; // stop here — user sees the ID before proceeding
      } catch (err) {
        setSubmitting(false);
        setSubmitError(err instanceof Error ? err.message : 'Failed to pre-register API ID.');
        return;
      }
    }

    // Phase 2 — createApi (or updateApi) using the confirmed/existing ID
    const effectiveApiId = preRegisteredApiId ?? form.apiId.trim();
    const isUpdate = !!committedApiId;
    const body = {
      host: 'lightapi.net', service: 'service',
      action: isUpdate ? 'updateApi' : 'createApi', version: '0.1.0',
      data: {
        hostId: host, updateUser: userId,
        apiId: effectiveApiId, apiName: form.apiName.trim(),
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
        ...(form.categoryIds.length > 0 && { categoryIds: form.categoryIds }),
        ...(form.tagIds.length > 0 && { tagIds: form.tagIds }),
        ...(form.ownerPositionId && { ownerPositionId: form.ownerPositionId }),
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
    if (!committedApiId) setCommittedApiId(effectiveApiId);
    setPreRegisteredApiId(null);
    // Keep preRegisteredServiceId alive until the Version step has committed,
    // so CreateApiVersionStep can use it as a locked value.
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

    setPreRegisteredServiceId(null);
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

  const syncToolsToExternalRegistry = async (tools: typeof selectedMcpTools): Promise<void> => {
    const externalApiId = registrationExternalApiId ?? committedApiId;
    if (!isToolsSyncEnabled || !toolsSyncUrl || !externalApiId || !versionForm.apiVersion.trim()) return;
    const url = toolsSyncUrl
      .replace('{apiId}', encodeURIComponent(externalApiId))
      .replace('{version}', encodeURIComponent(versionForm.apiVersion.trim()));
    const gatewayServiceId = versionForm.serviceId.trim();
    const body: Record<string, unknown> = {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        ...(t.endpoint?.trim() && { identifier: t.endpoint.trim() }),
        ...(gatewayServiceId && { gateways: [gatewayServiceId] }),
        ...(t.routingDomain != null && { routingDomain: t.routingDomain }),
        ...(t.semanticNamespace != null && { semanticNamespace: t.semanticNamespace }),
        ...(t.sensitivityTier != null && { sensitivityTier: t.sensitivityTier }),
        ...(t.semanticWeight != null && { semanticWeight: t.semanticWeight }),
        ...(t.sourceProtocol != null && { sourceProtocol: t.sourceProtocol }),
        ...(t.lifecycleStatus != null && { lifecycleStatus: t.lifecycleStatus }),
        ...(t.costTier != null && { costTier: t.costTier }),
        ...(t.readOnly != null && { readOnly: t.readOnly }),
        ...(t.idempotent != null && { idempotent: t.idempotent }),
        ...(t.destructive != null && { destructive: t.destructive }),
        ...(t.humanApprovalRequired != null && { humanApprovalRequired: t.humanApprovalRequired }),
        ...(t.estimatedLatencyMs != null && { estimatedLatencyMs: t.estimatedLatencyMs }),
        ...(t.cacheTtlSeconds != null && { cacheTtlSeconds: t.cacheTtlSeconds }),
        ...(t.semanticDescription != null && { semanticDescription: t.semanticDescription }),
        ...(t.semanticKeywords != null && { semanticKeywords: t.semanticKeywords }),
        ...(t.parameterMappings != null && { parameterMappings: t.parameterMappings }),
        ...(t.targetPersonas != null && { targetPersonas: t.targetPersonas }),
      })),
    };
    const idToken = await getIdToken();
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!response.ok) {
      let errorMessage = `Tools sync failed (${response.status})`;
      try {
        const errData = await response.json() as Record<string, unknown>;
        const extracted = toolsSyncErrorPath
          ? getValueByPath(errData, toolsSyncErrorPath)
          : (errData.message ?? errData.error ?? errData.detail);
        if (typeof extracted === 'string' && extracted.trim()) errorMessage = extracted.trim();
      } catch { /* not JSON */ }
      throw new Error(errorMessage);
    }
  };

  const handleSaveMcpTools = async (): Promise<boolean> => {
    if (selectedMcpTools.length === 0 && !mcpMeta.exists) return true;
    const toolErrors = validateToolMetadataInputs(selectedMcpTools);
    if (toolErrors.length > 0) {
      setSubmitError(toolErrors.join(' '));
      return false;
    }
    if (!mcpMeta.propertyId) {
      setSubmitError('Missing configuration metadata. Please skip this step and configure MCP tools from the Instance admin.');
      return false;
    }
    setSubmitting(true);
    setSubmitError(null);

    // Sync to external registry first — failure surfaces to the user for retry
    try {
      await syncToolsToExternalRegistry(selectedMcpTools);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Failed to sync tools to external registry. Please try again.');
      return false;
    }

    const propertyValue = JSON.stringify(
      selectedMcpTools.map((t) => {
        const obj: any = {
          endpointId: t.endpointId,
          endpointName: t.endpointName,
          name: t.name, endpoint: t.endpoint, method: t.method, path: t.path,
          description: t.description,
          inputSchema: t.inputSchema ? (() => { try { return JSON.parse(t.inputSchema!); } catch { return t.inputSchema; } })() : undefined,
          toolSchema: t.inputSchema ? (() => { try { return JSON.parse(t.inputSchema!); } catch { return t.inputSchema; } })() : undefined,
          toolMetadata: buildToolMetadata(t),
          routingDomain: t.routingDomain,
          semanticNamespace: t.semanticNamespace,
          sensitivityTier: t.sensitivityTier,
          semanticWeight: t.semanticWeight,
          sourceProtocol: t.sourceProtocol,
          lifecycleStatus: t.lifecycleStatus,
          costTier: t.costTier,
          readOnly: t.readOnly,
          idempotent: t.idempotent,
          destructive: t.destructive,
          humanApprovalRequired: t.humanApprovalRequired,
          estimatedLatencyMs: t.estimatedLatencyMs,
          cacheTtlSeconds: t.cacheTtlSeconds,
          semanticDescription: t.semanticDescription,
          semanticKeywords: t.semanticKeywords,
          targetPersonas: t.targetPersonas,
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
