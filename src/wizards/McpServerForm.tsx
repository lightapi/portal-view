import { Alert, Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SelectTypeStep from './mcp/SelectTypeStep';
import { useMcpWizardState } from './mcp/hooks/useMcpWizardState';
import { useMcpPrefill } from './mcp/hooks/useMcpPrefill';
import { useMcpWizardHandlers } from './mcp/hooks/useMcpWizardHandlers';
import WizardTabBar from './mcp/layout/WizardTabBar';
import WizardStepHeader from './mcp/layout/WizardStepHeader';
import WizardNavActions from './mcp/layout/WizardNavActions';

export default function McpServerForm() {
  const state = useMcpWizardState();
  useMcpPrefill(state);
  const handlers = useMcpWizardHandlers(state);

  const {
    navigate, isPreFilled,
    creationType, setCreationType,
    step, flow, ctx, stepMeta,
    currentFlowStep, isLastFlowStep,
    maxStep, setStep,
    submitError, submitting,
    committedApiId, committedApiVersionId, committedInstanceApiId,
    selectedInstanceId, existingApiSelection,
    selectedMcpTools,
  } = state;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Page header */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 3, pt: 2.5, pb: 1.5 }}>
        <Tooltip title="Back to MCP Gateway">
          <IconButton size="small" onClick={() => navigate('/app/mcp/gateway')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h5" fontWeight="medium">
            {isPreFilled ? 'Configure MCP Server' : 'Onboard to MCP Gateway'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isPreFilled
              ? 'Update MCP tool configuration for this API'
              : 'Register an API or standalone server as an MCP tool source'}
          </Typography>
        </Box>
      </Box>

      {/* Horizontal step tab bar */}
      {creationType && step > 0 && flow && (
        <WizardTabBar
          flow={flow}
          step={step}
          maxStep={maxStep}
          ctx={ctx}
          onChange={(s) => setStep(s)}
        />
      )}

      {/* Scrollable content area */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', px: 3, pb: 3 }}>
        <WizardStepHeader key={step} title={stepMeta.title} description={stepMeta.description} />

        <Stack spacing={3}>
          {step === 0
            ? <SelectTypeStep value={creationType} onChange={setCreationType} />
            : currentFlowStep?.render(ctx)}
        </Stack>

        {submitError && <Alert severity="error" sx={{ mt: 3 }}>{submitError}</Alert>}

        <WizardNavActions
          action={currentFlowStep?.action}
          skippable={currentFlowStep?.skippable}
          submitting={submitting}
          isLastFlowStep={isLastFlowStep}
          step={step}
          creationType={creationType}
          committedApiId={committedApiId}
          committedApiVersionId={committedApiVersionId}
          committedInstanceApiId={committedInstanceApiId}
          selectedInstanceId={selectedInstanceId}
          existingApiSelection={existingApiSelection}
          selectedMcpToolsCount={selectedMcpTools.length}
          onCommitApi={handlers.handleCommitApi}
          onCommitVersion={handlers.handleCommitVersion}
          onLinkInstance={handlers.handleLinkInstance}
          onSaveMcpTools={handlers.handleSaveMcpTools}
          onExistingApiContinue={handlers.handleExistingApiContinue}
          onNext={handlers.handleNext}
          onSkipToList={() => navigate('/app/mcp/gateway')}
          onAdvanceFromTools={handlers.advanceFromTools}
          onNavigateToList={() => navigate('/app/mcp/gateway')}
        />
      </Box>
    </Box>
  );
}
