
/**
 * flowConfig.tsx
 *
 * Single source of truth for all per-flow, per-step configuration.
 * Each FlowStep bundles the tab label, icons, step header copy, primary
 * button action, done predicate, and render function — so the wizard shell
 * (McpServerForm) only needs to look up the current step and act on it.
 *
 * Adding a new flow type means adding a new FlowConfig entry here; no changes
 * to the wizard shell are required.
 */
import type { ReactElement, ReactNode } from 'react';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CreateApiStep from './CreateApiStep';
import CreateApiVersionStep from './CreateApiVersionStep';
import SelectGatewayStep from './SelectGatewayStep';
import SelectGatewayModeStep from './SelectGatewayModeStep';
import SelectApiOriginStep from './SelectApiOriginStep';
import type { ApiOrigin } from './SelectApiOriginStep';
import SelectMcpToolsStep from './SelectMcpToolsStep';
import AccessControlStep from './AccessControlStep';
import SelectExistingApiStep from './SelectExistingApiStep';
import UploadSpecStep from './UploadSpecStep';
import type { ExistingApiSelection } from './SelectExistingApiStep';
import type { CreateApiForm, CreateApiVersionForm, McpToolType, McpToolsMeta } from './types';
import type { McpCreationType } from './SelectTypeStep';

// ── Shared wizard state injected into every step ─────────────────────────────

export type WizardCtx = {
  host: string;
  form: CreateApiForm;
  apiErrors: Partial<Record<keyof CreateApiForm, string>>;
  patch: (p: Partial<CreateApiForm>) => void;
  versionForm: CreateApiVersionForm;
  versionErrors: Partial<Record<keyof CreateApiVersionForm, string>>;
  patchVersion: (p: Partial<CreateApiVersionForm>) => void;
  committedApiId: string;
  committedApiVersionId: string;
  committedInstanceApiId: string;
  selectedInstanceId: string;
  setSelectedInstanceId: (id: string) => void;
  gatewayMode: 'centralized' | 'distributed' | null;
  setGatewayMode: (m: 'centralized' | 'distributed') => void;
  apiOrigin: ApiOrigin | null;
  setApiOrigin: (o: ApiOrigin) => void;
  mcpMeta: McpToolsMeta;
  setMcpMeta: (m: McpToolsMeta) => void;
  setSelectedMcpTools: (t: McpToolType[]) => void;
  existingApiSelection: ExistingApiSelection | null;
  setExistingApiSelection: (s: ExistingApiSelection | null) => void;
  toolsCommitted: boolean;
  accessExists: boolean;
  setAccessExists: (v: boolean) => void;
  maxStep: number;
};

// ── Primary button action — drives button rendering in the wizard shell ───────

export type StepAction =
  | 'next'           // generic Next (optionally skippable)
  | 'save-api'       // POST createApi → advance
  | 'save-version'   // POST createApiVersion → advance / skip
  | 'link-gateway'   // POST createInstanceApi → advance / skip
  | 'save-tools'     // POST MCP tool selection → advance / skip
  | 'finish'         // final step — Finish or Skip
  | 'pick-existing'; // select existing API → continue

// ── Per-step definition ───────────────────────────────────────────────────────

export type FlowStep = {
  /** Tab bar label */
  label: string;
  /** Icon shown in the tab circle when the step is not yet done */
  icon: ReactElement;
  /** Icon shown when the step is complete */
  doneIcon: ReactElement;
  /** Step header title */
  title: string;
  /** Step header description */
  description: string;
  /** Controls which primary CTA button the wizard shell renders */
  action: StepAction;
  /** Show a secondary "Skip" option alongside the primary button */
  skippable?: boolean;
  /** Whether the step counts as done — drives the ✓ tab icon */
  isDone: (ctx: WizardCtx) => boolean;
  /** Step body — receives wizard state, returns rendered content */
  render: (ctx: WizardCtx) => ReactNode;
};

export type FlowConfig = { steps: FlowStep[] };

// ── Shared done icon (reused across all flows) ────────────────────────────────

const DONE = <CheckIcon sx={{ fontSize: 14 }} />;

// ── Flow: New API via OpenAPI spec ────────────────────────────────────────────

const API_FLOW: FlowConfig = {
  steps: [
    {
      label: 'Origin',
      icon: <PublicOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'What type of API is this?',
      description: 'Internal APIs managed within your organization should be onboarded via the platform portal. Third-party APIs from external vendors can be registered directly here.',
      action: 'next',
      isDone: (ctx) => ctx.apiOrigin === 'third-party',
      render: (ctx) => (
        <SelectApiOriginStep value={ctx.apiOrigin} onChange={ctx.setApiOrigin} />
      ),
    },
    {
      label: 'Specification',
      icon: <CodeOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Upload OpenAPI Spec',
      description: 'Upload your OpenAPI specification (JSON or YAML). Fields in the next step will be pre-filled from the spec — you can review and adjust them before submitting.',
      action: 'next',
      skippable: true,
      isDone: (ctx) => ctx.maxStep > 1,
      render: (ctx) => <UploadSpecStep patch={ctx.patch} patchVersion={ctx.patchVersion} />,
    },
    {
      label: 'API',
      icon: <ApiOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Create Logical API',
      description: 'Review the details pre-filled from your spec and fill in any remaining required fields. Click "Save & Continue" to commit the API — you will then add a version in the next step.',
      action: 'save-api',
      isDone: (ctx) => !!ctx.committedApiId,
      render: (ctx) => (
        <CreateApiStep form={ctx.form} errors={ctx.apiErrors} patch={ctx.patch} host={ctx.host} />
      ),
    },
    {
      label: 'Version',
      icon: <LayersOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Add API Version',
      description: 'The logical API has been saved. Fill in the version details and click "Save & Continue" to commit — you will then configure which tools to expose.',
      action: 'save-version',
      skippable: true,
      isDone: (ctx) => !!ctx.committedApiVersionId,
      render: (ctx) => (
        <CreateApiVersionStep
          committedApiId={ctx.committedApiId}
          form={ctx.versionForm}
          errors={ctx.versionErrors}
          patch={ctx.patchVersion}
          host={ctx.host}
        />
      ),
    },
    {
      label: 'Deployment',
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Choose Deployment Mode',
      description: 'Decide how this API will be exposed as MCP — through a centralized shared gateway, or directly on the service\'s own sidecar instance.',
      action: 'next',
      isDone: (ctx) => !!ctx.gatewayMode,
      render: (ctx) => (
        <SelectGatewayModeStep
          value={ctx.gatewayMode}
          onChange={ctx.setGatewayMode}
          distributedInstanceIds={
            ctx.existingApiSelection
              ? ctx.existingApiSelection.distributedInstanceIds
              : []
          }
          distributedDisabledReason={
            ctx.existingApiSelection
              ? undefined
              : "Distributed deployment for new third-party APIs is coming soon. Please use Centralized for now."
          }
        />
      ),
    },
    {
      label: 'Instance',
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Select Gateway Instance',
      description: 'Link this API version to a gateway or sidecar instance. This is required to configure MCP tools in the next step.',
      action: 'link-gateway',
      skippable: true,
      isDone: (ctx) => !!ctx.committedInstanceApiId,
      render: (ctx) => (
        <SelectGatewayStep
          host={ctx.host}
          selectedInstanceId={ctx.selectedInstanceId}
          onChange={ctx.setSelectedInstanceId}
          gatewayType={ctx.gatewayMode ?? 'centralized'}
          allowedInstanceIds={
            ctx.gatewayMode === 'distributed'
              ? ctx.existingApiSelection?.distributedInstanceIds
              : undefined
          }
        />
      ),
    },
    {
      label: 'Tools',
      icon: <HubOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Select MCP Tools',
      description: 'Choose which API endpoints to register as MCP tools on the sidecar. You can change this at any time from the Instance admin.',
      action: 'save-tools',
      skippable: true,
      isDone: (ctx) => ctx.mcpMeta.exists || ctx.toolsCommitted,
      render: (ctx) => (
        <SelectMcpToolsStep
          host={ctx.host}
          instanceApiId={ctx.committedInstanceApiId}
          apiVersionId={ctx.committedApiVersionId}
          apiName={ctx.form.apiName}
          onMetaChange={ctx.setMcpMeta}
          onSelectionChange={ctx.setSelectedMcpTools}
        />
      ),
    },
    {
      label: 'Access',
      icon: <LockOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Configure Access Control',
      description: 'Optionally restrict which roles can invoke each MCP tool endpoint. Skip this step to allow all authenticated users full access — you can configure it later from the Role Admin.',
      action: 'finish',
      isDone: (ctx) => ctx.accessExists,
      render: (ctx) => (
        <AccessControlStep
          host={ctx.host}
          apiId={ctx.committedApiId}
          apiVersion={ctx.versionForm.apiVersion}
          apiVersionId={ctx.committedApiVersionId}
          instanceApiId={ctx.committedInstanceApiId}
          onHasAccess={ctx.setAccessExists}
        />
      ),
    },
  ],
};

// ── Flow: Continue from existing API (API_FLOW minus the Origin step) ─────────
// Used when the user arrives via SelectExistingApiStep — the Origin
// question is irrelevant because the API is already registered.
const API_CONTINUE_FLOW: FlowConfig = {
  steps: API_FLOW.steps.slice(1),
};

// ── Flow: Standalone MCP server (API with apiType = 'mcp') ───────────────────

const SERVER_FLOW: FlowConfig = {
  steps: [
    {
      label: 'Server',
      icon: <ApiOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Register MCP Server',
      description: 'Fill in the details for your standalone MCP server. This registers it as a logical API in the platform.',
      action: 'save-api',
      isDone: (ctx) => !!ctx.committedApiId,
      render: (ctx) => (
        <CreateApiStep form={ctx.form} errors={ctx.apiErrors} patch={ctx.patch} host={ctx.host} mode="server" />
      ),
    },
    {
      label: 'Version',
      icon: <LayersOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Add Server Version',
      description: 'API Type is pre-set to "mcp". Set the transport config URL — this is where the BFF will connect to discover available tools.',
      action: 'save-version',
      skippable: true,
      isDone: (ctx) => !!ctx.committedApiVersionId,
      render: (ctx) => (
        <CreateApiVersionStep
          committedApiId={ctx.committedApiId}
          form={ctx.versionForm}
          errors={ctx.versionErrors}
          patch={ctx.patchVersion}
          host={ctx.host}
          mode="server"
        />
      ),
    },
    {
      label: 'Deployment',
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Choose Deployment Mode',
      description: 'Decide how this MCP server will be exposed — through a centralized shared gateway, or directly on the service\'s own sidecar instance.',
      action: 'next',
      isDone: (ctx) => !!ctx.gatewayMode,
      render: (ctx) => (
        <SelectGatewayModeStep
          value={ctx.gatewayMode}
          onChange={ctx.setGatewayMode}
          distributedInstanceIds={[]}
          distributedDisabledReason="Standalone MCP servers must be deployed through a centralized gateway."
        />
      ),
    },
    {
      label: 'Instance',
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Select Instance',
      description: 'Choose the instance to link this MCP server to.',
      action: 'link-gateway',
      skippable: true,
      isDone: (ctx) => !!ctx.committedInstanceApiId,
      render: (ctx) => (
        <SelectGatewayStep
          host={ctx.host}
          selectedInstanceId={ctx.selectedInstanceId}
          onChange={ctx.setSelectedInstanceId}
          gatewayType={ctx.gatewayMode ?? 'distributed'}
        />
      ),
    },
    {
      label: 'Tools',
      icon: <HubOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Configure MCP Tools',
      description: 'Review and filter which tools from this MCP server will be exposed through the gateway. You can change this at any time from the Instance admin.',
      action: 'save-tools',
      skippable: true,
      isDone: (ctx) => ctx.mcpMeta.exists || ctx.toolsCommitted,
      render: (ctx) => (
        <SelectMcpToolsStep
          host={ctx.host}
          instanceApiId={ctx.committedInstanceApiId}
          apiVersionId={ctx.committedApiVersionId}
          apiName={ctx.form.apiName}
          onMetaChange={ctx.setMcpMeta}
          onSelectionChange={ctx.setSelectedMcpTools}
        />
      ),
    },
    {
      label: 'Access',
      icon: <LockOutlinedIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Configure Access Control',
      description: 'Optionally restrict which roles can invoke each MCP tool endpoint. This applies at the MCP server level and does not require gateway onboarding.',
      action: 'finish',
      isDone: (ctx) => ctx.accessExists,
      render: (ctx) => (
        <AccessControlStep
          host={ctx.host}
          apiId={ctx.committedApiId}
          apiVersion={ctx.versionForm.apiVersion}
          apiVersionId={ctx.committedApiVersionId}
          instanceApiId={ctx.committedInstanceApiId}
          onHasAccess={ctx.setAccessExists}
        />
      ),
    },
  ],
};

// ── Flow: Continue from an existing registered API ─────────────────────────

const EXISTING_API_FLOW: FlowConfig = {
  steps: [
    {
      label: 'Select',
      icon: <SearchIcon sx={{ fontSize: 16 }} />,
      doneIcon: DONE,
      title: 'Select Existing API',
      description: 'Pick an existing API and optionally a version to continue configuration from where it currently is.',
      action: 'pick-existing',
      isDone: (ctx) => !!ctx.existingApiSelection,
      render: (ctx) => (
        <SelectExistingApiStep
          host={ctx.host}
          selection={ctx.existingApiSelection}
          onChange={ctx.setExistingApiSelection}
          mode="existing-api"
        />
      ),
    },
  ],
};

// ── Flow: Onboard an existing versioned MCP server to a gateway ─────────────

export const ONBOARD_FLOW: FlowConfig = {
  steps: [
    {
      label: 'Select',
      icon: <SearchIcon sx={{ fontSize: 16 }} />, doneIcon: DONE,
      title: 'Select MCP Server',
      description: 'Pick an already-registered MCP server and select the specific version to onboard. The wizard will then link it to a gateway and let you configure which tools to expose.',
      action: 'pick-existing',
      isDone: (ctx) => !!(ctx.existingApiSelection?.apiVersionId),
      render: (ctx) => (
        <SelectExistingApiStep
          host={ctx.host}
          selection={ctx.existingApiSelection}
          onChange={ctx.setExistingApiSelection}
          mode="gateway-onboard"
        />
      ),
    },
    {
      label: 'Gateway',
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />, doneIcon: DONE,
      title: 'Select Gateway Instance',
      description: 'Choose a Light AI Gateway instance (productId = lg) to proxy requests to this MCP server.',
      action: 'link-gateway',
      skippable: true,
      isDone: (ctx) => !!ctx.committedInstanceApiId,
      render: (ctx) => (
        <SelectGatewayStep
          host={ctx.host}
          selectedInstanceId={ctx.selectedInstanceId}
          onChange={ctx.setSelectedInstanceId}
          gatewayType="centralized"
        />
      ),
    },
    {
      label: 'Tools',
      icon: <HubOutlinedIcon sx={{ fontSize: 16 }} />, doneIcon: DONE,
      title: 'Select MCP Tools',
      description: 'Choose which tools exposed by this MCP server to register on the gateway.',
      action: 'save-tools',
      skippable: true,
      isDone: (ctx) => ctx.mcpMeta.exists || ctx.toolsCommitted,
      render: (ctx) => (
        <SelectMcpToolsStep
          host={ctx.host}
          instanceApiId={ctx.committedInstanceApiId}
          apiVersionId={ctx.committedApiVersionId}
          apiName={ctx.form.apiName}
          onMetaChange={ctx.setMcpMeta}
          onSelectionChange={ctx.setSelectedMcpTools}
        />
      ),
    },
  ],
};

// Step 0 (type selection) is outside any flow — its header copy lives here
export const SELECT_STEP = {
  title: 'What would you like to add?',
  description: 'Choose whether to pick an existing registered API, create a new one from an OpenAPI spec, or register a standalone MCP server.',
};

// ── Export all flows for wizard shell ───────────────────────────────────────
export const FLOWS = {
  api: API_FLOW,
  'api-continue': API_CONTINUE_FLOW,
  server: SERVER_FLOW,
  'existing-api': EXISTING_API_FLOW,
  onboard: ONBOARD_FLOW,
};