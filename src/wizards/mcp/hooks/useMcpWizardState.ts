import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserState } from '../../../contexts/UserContext';
import { EMPTY_CREATE_API_FORM, EMPTY_CREATE_API_VERSION_FORM } from '../types';
import type { CreateApiForm, CreateApiVersionForm, McpToolType, McpToolsMeta, UserState } from '../types';
import type { ExistingApiSelection } from '../SelectExistingApiStep';
import type { ApiOrigin } from '../SelectApiOriginStep';
import type { McpCreationType } from '../SelectTypeStep';
import { FLOWS, SELECT_STEP, type WizardCtx, type FlowStep } from '../flowConfig';

export function useMcpWizardState() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { host, userId } = useUserState() as UserState;

  const preApiId         = searchParams.get('apiId') ?? '';
  const preApiVersionId  = searchParams.get('apiVersionId') ?? '';
  const preInstanceApiId = searchParams.get('instanceApiId') ?? '';
  const preInstanceId    = searchParams.get('instanceId') ?? '';
  const preFlow          = searchParams.get('flow') ?? '';
  const isPreFilled = !!(preInstanceApiId || (preApiId && preApiVersionId));

  const getInitialStep = () => {
    if (preInstanceApiId) return preFlow === 'server' ? 5 : 6;  // server: Tools=step5; api-continue: Tools=step6
    if (preApiId && preApiVersionId) return preFlow === 'server' ? 2 : 4;  // api-continue: deployment step; server: version step
    if (preFlow === 'onboard') return 1;
    return 0;
  };

  const getInitialMaxStep = () => {
    if (preInstanceApiId) return preFlow === 'server' ? 6 : 7;  // server has 6 steps; api-continue has 7
    if (preApiId && preApiVersionId) return preFlow === 'server' ? 3 : 7;
    if (preFlow === 'onboard') return 1;
    return 0;
  };

  const [creationType, setCreationType] = useState<McpCreationType | null>(() => {
    if (!isPreFilled && preFlow !== 'onboard') return null;
    if (preFlow === 'server') return 'server';
    if (preFlow === 'onboard') return 'onboard';
    return 'api-continue';  // URL-prefilled API deeplinks also skip the Origin step
  });

  const [step, setStep] = useState(getInitialStep);
  const [maxStep, setMaxStep] = useState(getInitialMaxStep);

  const advance = (to?: number) => {
    const next = to ?? step + 1;
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  };

  const [form, setForm] = useState<CreateApiForm>({ ...EMPTY_CREATE_API_FORM, hostId: host ?? '' });
  const [apiErrors, setApiErrors] = useState<Partial<Record<keyof CreateApiForm, string>>>({});
  const [apiAggregateVersion, setApiAggregateVersion] = useState<number>(0);
  const [committedApiId, setCommittedApiId] = useState(preApiId);
  const [committedApiVersionId, setCommittedApiVersionId] = useState(preApiVersionId);

  const [versionForm, setVersionForm] = useState<CreateApiVersionForm>({ ...EMPTY_CREATE_API_VERSION_FORM });
  const [versionErrors, setVersionErrors] = useState<Partial<Record<keyof CreateApiVersionForm, string>>>({});
  const [versionAggregateVersion, setVersionAggregateVersion] = useState<number>(0);

  const [selectedInstanceId, setSelectedInstanceId] = useState(preInstanceId);
  const [gatewayMode, setGatewayMode] = useState<'centralized' | 'distributed' | null>(null);
  const [apiOrigin, setApiOrigin] = useState<ApiOrigin | null>(null);
  const [committedInstanceApiId, setCommittedInstanceApiId] = useState(preInstanceApiId);

  const [existingApiSelection, setExistingApiSelection] = useState<ExistingApiSelection | null>(null);

  const [mcpMeta, setMcpMeta] = useState<McpToolsMeta>({ propertyId: null, configId: null, aggregateVersion: 0, exists: false });
  const [selectedMcpTools, setSelectedMcpTools] = useState<McpToolType[]>([]);
  const [toolsCommitted, setToolsCommitted] = useState(false);
  const [accessExists, setAccessExists] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = useCallback((p: Partial<CreateApiForm>) => setForm((f) => ({ ...f, ...p })), []);
  const patchVersion = useCallback((p: Partial<CreateApiVersionForm>) => setVersionForm((f) => ({ ...f, ...p })), []);
  const handleSetMcpMeta = useCallback((m: McpToolsMeta) => setMcpMeta(m), []);
  const handleSetSelectedMcpTools = useCallback((t: McpToolType[]) => setSelectedMcpTools(t), []);
  const handleSetExistingApiSelection = useCallback((s: ExistingApiSelection | null) => setExistingApiSelection(s), []);

  const flow = creationType ? FLOWS[creationType as keyof typeof FLOWS] : null;
  const currentFlowStep: FlowStep | undefined = flow && step > 0 ? flow.steps[step - 1] : undefined;
  const isLastFlowStep = !!(flow && step >= flow.steps.length);

  const ctx: WizardCtx = useMemo(() => ({
    host: host ?? '',
    form,
    apiErrors,
    patch,
    versionForm,
    versionErrors,
    patchVersion,
    committedApiId,
    committedApiVersionId,
    committedInstanceApiId,
    selectedInstanceId,
    setSelectedInstanceId,
    gatewayMode,
    setGatewayMode,
    apiOrigin,
    setApiOrigin,
    mcpMeta,
    setMcpMeta: handleSetMcpMeta,
    setSelectedMcpTools: handleSetSelectedMcpTools,
    existingApiSelection,
    setExistingApiSelection: handleSetExistingApiSelection,
    toolsCommitted,
    accessExists,
    setAccessExists,
    maxStep,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [host, form, apiErrors, versionForm, versionErrors, committedApiId, committedApiVersionId, committedInstanceApiId, selectedInstanceId, gatewayMode, apiOrigin, mcpMeta, existingApiSelection, toolsCommitted, accessExists, maxStep]);

  const stepMeta = currentFlowStep ?? SELECT_STEP;

  return {
    navigate,
    // URL params
    preApiId, preApiVersionId, preInstanceApiId, preFlow, isPreFilled,
    // user
    host, userId,
    // wizard navigation
    creationType, setCreationType,
    step, setStep, maxStep, setMaxStep, advance,
    // API form
    form, apiErrors, setApiErrors,
    apiAggregateVersion, setApiAggregateVersion,
    committedApiId, setCommittedApiId,
    // version form
    versionForm, versionErrors, setVersionErrors,
    versionAggregateVersion, setVersionAggregateVersion,
    committedApiVersionId, setCommittedApiVersionId,
    // gateway linking
    selectedInstanceId, setSelectedInstanceId,
    gatewayMode, setGatewayMode,
    apiOrigin, setApiOrigin,
    committedInstanceApiId, setCommittedInstanceApiId,
    // existing API picker
    existingApiSelection,
    // MCP tools
    mcpMeta, selectedMcpTools,
    toolsCommitted, setToolsCommitted,
    // access
    accessExists,
    // submission UI
    submitting, setSubmitting,
    submitError, setSubmitError,
    // stable callbacks
    patch, patchVersion,
    handleSetMcpMeta, handleSetSelectedMcpTools, handleSetExistingApiSelection,
    // derived flow state
    flow, currentFlowStep, isLastFlowStep, ctx, stepMeta,
  };
}

export type McpWizardState = ReturnType<typeof useMcpWizardState>;
