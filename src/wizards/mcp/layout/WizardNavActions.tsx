import { Box, Button, CircularProgress } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import type { ExistingApiSelection } from '../SelectExistingApiStep';
import type { McpCreationType } from '../SelectTypeStep';

interface WizardNavActionsProps {
  action: string | undefined;
  submitting: boolean;
  isLastFlowStep: boolean;
  skippable?: boolean;
  // state for labels / disabled
  step: number;
  creationType: McpCreationType | null;
  committedApiId: string;
  committedApiVersionId: string;
  committedInstanceApiId: string;
  selectedInstanceId: string;
  existingApiSelection: ExistingApiSelection | null;
  selectedMcpToolsCount: number;
  // callbacks
  onCommitApi: () => void;
  onCommitVersion: () => Promise<void>;
  onLinkInstance: () => Promise<void>;
  onSaveMcpTools: () => Promise<boolean>;
  onExistingApiContinue: () => void;
  onNext: () => void;
  onSkipToList: () => void;
  onAdvanceFromTools: () => void;
  onNavigateToList: () => void;
}

/** Bottom navigation button group for the MCP wizard — driven by the current step's action type. */
export default function WizardNavActions({
  action, submitting, isLastFlowStep, skippable,
  step, creationType,
  committedApiId, committedApiVersionId, committedInstanceApiId, selectedInstanceId,
  existingApiSelection, selectedMcpToolsCount,
  onCommitApi, onCommitVersion, onLinkInstance, onSaveMcpTools,
  onExistingApiContinue, onNext, onSkipToList, onAdvanceFromTools, onNavigateToList,
}: WizardNavActionsProps) {
  const spinner = <CircularProgress size={18} color="inherit" />;
  const forwardIcon = isLastFlowStep ? <CheckIcon /> : <ArrowForwardIcon />;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 4 }}>

      {/* commit createApi */}
      {action === 'save-api' && (
        <Button
          variant="contained"
          endIcon={submitting ? spinner : <ArrowForwardIcon />}
          onClick={onCommitApi}
          disabled={submitting}
        >
          {committedApiId ? 'Next' : 'Save & Continue'}
        </Button>
      )}

      {/* commit createApiVersion */}
      {action === 'save-version' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onSkipToList} disabled={submitting}>Skip for now</Button>
          <Button
            variant="contained"
            endIcon={submitting ? spinner : forwardIcon}
            onClick={async () => { await onCommitVersion(); if (isLastFlowStep) onNavigateToList(); }}
            disabled={submitting}
          >
            {committedApiVersionId ? (isLastFlowStep ? 'Finish' : 'Next') : (isLastFlowStep ? 'Save & Finish' : 'Save & Continue')}
          </Button>
        </Box>
      )}

      {/* createInstanceApi */}
      {action === 'link-gateway' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onSkipToList} disabled={submitting}>Skip for now</Button>
          <Button
            variant="contained"
            endIcon={submitting ? spinner : forwardIcon}
            onClick={async () => { await onLinkInstance(); if (isLastFlowStep) onNavigateToList(); }}
            disabled={submitting || (!committedInstanceApiId && !selectedInstanceId)}
          >
            {committedInstanceApiId ? (isLastFlowStep ? 'Finish' : 'Next') : (isLastFlowStep ? 'Save & Finish' : 'Save & Continue')}
          </Button>
        </Box>
      )}

      {/* save MCP tool selection */}
      {action === 'save-tools' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="text" color="inherit" onClick={() => { onAdvanceFromTools(); onSkipToList(); }} disabled={submitting}>
            Skip for now
          </Button>
          <Button
            variant="contained"
            endIcon={submitting ? spinner : <ArrowForwardIcon />}
            onClick={async () => { const ok = await onSaveMcpTools(); if (ok) onAdvanceFromTools(); }}
            disabled={submitting}
          >
            {selectedMcpToolsCount === 0 ? 'Next' : 'Save & Continue'}
          </Button>
        </Box>
      )}

      {/* final step */}
      {action === 'finish' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="text" color="inherit" onClick={onNavigateToList}>Skip</Button>
          <Button variant="contained" startIcon={<CheckIcon />} onClick={onNavigateToList}>Finish</Button>
        </Box>
      )}

      {/* pick existing API */}
      {action === 'pick-existing' && (
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={onExistingApiContinue}
          disabled={!existingApiSelection}
        >
          Continue
        </Button>
      )}

      {/* generic Next — step 0 type selection + spec upload */}
      {(!action || action === 'next') && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {skippable && <Button variant="text" color="inherit" onClick={onNext}>Skip</Button>}
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={onNext}
            disabled={step === 0 && !creationType}
          >
            Next
          </Button>
        </Box>
      )}

    </Box>
  );
}
