import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  extractPathParameters,
  inputSchemaPropertyNames,
  missingPathParameterMappings,
} from '../../utils/toolMetadata';
import type { McpToolType } from './types';
import type { EditDraft, ToolMetadataReferenceOptions } from './SelectMcpToolsStep';

interface ToolListRowProps {
  tool: McpToolType;
  isSelected: boolean;
  isEditing: boolean;
  editDraft: EditDraft;
  referenceOptions: ToolMetadataReferenceOptions;
  onToggle: (endpoint: string) => void;
  onStartEdit: (e: React.MouseEvent, tool: McpToolType) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditDraftChange: (draft: EditDraft) => void;
}

function optionLabel(options: Array<{ value: string; label: string }>, value?: string) {
  if (!value) return '';
  return options.find((option) => option.value === value)?.label ?? value;
}

function selectOptions(options: Array<{ value: string; label: string }>, current?: string) {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

function metadataChip(label: string, value?: string) {
  if (!value) return null;
  return <Chip key={`${label}-${value}`} size="small" variant="outlined" label={`${label}: ${value}`} />;
}

function draftField(field: keyof EditDraft, editDraft: EditDraft, onEditDraftChange: (draft: EditDraft) => void) {
  return (value: string | boolean | Record<string, string>) => onEditDraftChange({ ...editDraft, [field]: value });
}

function uniqueParameterNames(tool: McpToolType) {
  return Array.from(new Set([
    ...extractPathParameters(tool.path),
    ...inputSchemaPropertyNames(tool.inputSchema),
  ]));
}

/** Single tool row in SelectMcpToolsStep — handles both view mode and inline edit mode. */
export default function ToolListRow({
  tool, isSelected, isEditing, editDraft,
  referenceOptions,
  onToggle, onStartEdit, onSaveEdit, onCancelEdit, onEditDraftChange,
}: ToolListRowProps) {
  const parameters = uniqueParameterNames(tool);
  const pathParams = new Set(extractPathParameters(tool.path));
  const missingPathMappings = missingPathParameterMappings(tool);

  const setParameterMapping = (parameter: string, location: string) => {
    const parameterMappings = { ...editDraft.parameterMappings };
    if (location) parameterMappings[parameter] = location;
    else delete parameterMappings[parameter];
    onEditDraftChange({ ...editDraft, parameterMappings });
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, px: 2, py: 1.5, bgcolor: (t) => alpha(t.palette.warning.main, 0.05) }}>
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(tool.endpoint)}
          size="small"
          sx={{ mt: 0.5, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            size="small"
            label="Tool name"
            value={editDraft.name}
            onChange={(e) => draftField('name', editDraft, onEditDraftChange)(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            fullWidth
            autoFocus
          />
          <TextField
            size="small"
            label="Description"
            value={editDraft.description}
            onChange={(e) => draftField('description', editDraft, onEditDraftChange)(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancelEdit(); }}
            fullWidth
            multiline
            minRows={2}
          />
          <Accordion disableGutters variant="outlined" sx={{ bgcolor: 'background.paper' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={700}>Advanced metadata</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">Routing</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <TextField
                    size="small"
                    label="Routing domain"
                    value={editDraft.routingDomain}
                    onChange={(e) => draftField('routingDomain', editDraft, onEditDraftChange)(e.target.value)}
                    sx={{ flex: '1 1 180px' }}
                  />
                  <TextField
                    size="small"
                    label="Semantic namespace"
                    value={editDraft.semanticNamespace}
                    onChange={(e) => draftField('semanticNamespace', editDraft, onEditDraftChange)(e.target.value)}
                    sx={{ flex: '1 1 180px' }}
                  />
                  <TextField
                    size="small"
                    label="Semantic weight"
                    type="number"
                    value={editDraft.semanticWeight}
                    onChange={(e) => draftField('semanticWeight', editDraft, onEditDraftChange)(e.target.value)}
                    inputProps={{ min: 0, max: 10, step: 0.1 }}
                    sx={{ flex: '1 1 140px' }}
                  />
                  <FormControl size="small" sx={{ flex: '1 1 160px' }}>
                    <InputLabel>Source protocol</InputLabel>
                    <Select
                      label="Source protocol"
                      value={editDraft.sourceProtocol}
                      onChange={(e) => draftField('sourceProtocol', editDraft, onEditDraftChange)(e.target.value)}
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {selectOptions(referenceOptions.sourceProtocol, editDraft.sourceProtocol).map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Typography variant="caption" fontWeight={700} color="text.secondary">Governance</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <FormControl size="small" sx={{ flex: '1 1 180px' }}>
                    <InputLabel>Sensitivity tier</InputLabel>
                    <Select
                      label="Sensitivity tier"
                      value={editDraft.sensitivityTier}
                      onChange={(e) => draftField('sensitivityTier', editDraft, onEditDraftChange)(e.target.value)}
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {selectOptions(referenceOptions.sensitivityTier, editDraft.sensitivityTier).map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: '1 1 180px' }}>
                    <InputLabel>Lifecycle</InputLabel>
                    <Select
                      label="Lifecycle"
                      value={editDraft.lifecycleStatus}
                      onChange={(e) => draftField('lifecycleStatus', editDraft, onEditDraftChange)(e.target.value)}
                    >
                      {selectOptions(referenceOptions.lifecycleStatus, editDraft.lifecycleStatus).map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Typography variant="caption" fontWeight={700} color="text.secondary">Safety</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <FormControlLabel
                    control={<Switch size="small" checked={editDraft.readOnly} onChange={(e) => draftField('readOnly', editDraft, onEditDraftChange)(e.target.checked)} />}
                    label="Read only"
                  />
                  <FormControlLabel
                    control={<Switch size="small" checked={editDraft.idempotent} onChange={(e) => draftField('idempotent', editDraft, onEditDraftChange)(e.target.checked)} />}
                    label="Idempotent"
                  />
                  <FormControlLabel
                    control={<Switch size="small" checked={editDraft.destructive} onChange={(e) => draftField('destructive', editDraft, onEditDraftChange)(e.target.checked)} />}
                    label="Destructive"
                  />
                  <FormControlLabel
                    control={<Switch size="small" checked={editDraft.humanApprovalRequired} onChange={(e) => draftField('humanApprovalRequired', editDraft, onEditDraftChange)(e.target.checked)} />}
                    label="Approval"
                  />
                </Box>

                <Typography variant="caption" fontWeight={700} color="text.secondary">Runtime</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <FormControl size="small" sx={{ flex: '1 1 160px' }}>
                    <InputLabel>Cost tier</InputLabel>
                    <Select
                      label="Cost tier"
                      value={editDraft.costTier}
                      onChange={(e) => draftField('costTier', editDraft, onEditDraftChange)(e.target.value)}
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {selectOptions(referenceOptions.costTier, editDraft.costTier).map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Latency ms"
                    type="number"
                    value={editDraft.estimatedLatencyMs}
                    onChange={(e) => draftField('estimatedLatencyMs', editDraft, onEditDraftChange)(e.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ flex: '1 1 150px' }}
                  />
                  <TextField
                    size="small"
                    label="Cache TTL seconds"
                    type="number"
                    value={editDraft.cacheTtlSeconds}
                    onChange={(e) => draftField('cacheTtlSeconds', editDraft, onEditDraftChange)(e.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ flex: '1 1 170px' }}
                  />
                </Box>

                <Typography variant="caption" fontWeight={700} color="text.secondary">Search</Typography>
                <TextField
                  size="small"
                  label="Semantic description"
                  value={editDraft.semanticDescription}
                  onChange={(e) => draftField('semanticDescription', editDraft, onEditDraftChange)(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
                <TextField
                  size="small"
                  label="Semantic keywords"
                  value={editDraft.semanticKeywords}
                  onChange={(e) => draftField('semanticKeywords', editDraft, onEditDraftChange)(e.target.value)}
                  fullWidth
                />

                {parameters.length > 0 && (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">Parameter mapping</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                      {parameters.map((parameter) => {
                        const isMissingPathMapping = pathParams.has(parameter) && editDraft.parameterMappings[parameter] !== 'path';
                        return (
                          <FormControl key={parameter} size="small" error={isMissingPathMapping} sx={{ flex: '1 1 170px' }}>
                            <InputLabel>{parameter}</InputLabel>
                            <Select
                              label={parameter}
                              value={editDraft.parameterMappings[parameter] ?? ''}
                              onChange={(e) => setParameterMapping(parameter, e.target.value)}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {selectOptions(referenceOptions.parameterLocation, editDraft.parameterMappings[parameter]).map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </Select>
                            {isMissingPathMapping && <FormHelperText>Path parameter</FormHelperText>}
                          </FormControl>
                        );
                      })}
                    </Box>
                  </>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pt: 0.5, flexShrink: 0 }}>
          <Tooltip title="Save">
            <IconButton size="small" onClick={onSaveEdit} color="success"><CheckIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={onCancelEdit} color="error"><CloseIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      onClick={() => onToggle(tool.name)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, cursor: 'pointer',
        bgcolor: isSelected ? (t) => alpha(t.palette.primary.main, 0.05) : 'background.paper',
        transition: 'background-color 0.12s',
        '&:hover': { bgcolor: (t) => isSelected ? alpha(t.palette.primary.main, 0.08) : alpha(t.palette.action.hover, 0.06) },
        '&:hover .row-edit-btn': { opacity: 1 },
      }}
    >
      <Checkbox
        checked={isSelected}
        onChange={() => onToggle(tool.endpoint)}
        onClick={(e) => e.stopPropagation()}
        size="small"
        sx={{ flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} fontFamily="monospace" noWrap>
          {tool.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {[tool.method?.toUpperCase(), tool.path || tool.endpoint].filter(Boolean).join(' ')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {tool.description || <Box component="span" sx={{ fontStyle: 'italic', opacity: 0.45 }}>No description</Box>}
        </Typography>
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
          {metadataChip('protocol', optionLabel(referenceOptions.sourceProtocol, tool.sourceProtocol))}
          {metadataChip('sensitivity', optionLabel(referenceOptions.sensitivityTier, tool.sensitivityTier))}
          {metadataChip('lifecycle', optionLabel(referenceOptions.lifecycleStatus, tool.lifecycleStatus))}
          {metadataChip('cost', optionLabel(referenceOptions.costTier, tool.costTier))}
          {tool.readOnly && <Chip size="small" variant="outlined" label="read only" />}
          {tool.destructive && <Chip size="small" color="warning" variant="outlined" label="destructive" />}
          {missingPathMappings.length > 0 && <Chip size="small" color="warning" variant="outlined" label="mapping warning" />}
        </Stack>
      </Box>
      <Tooltip title="Edit name & description">
        <IconButton
          className="row-edit-btn"
          size="small"
          onClick={(e) => onStartEdit(e, tool)}
          sx={{ flexShrink: 0, opacity: 0, transition: 'opacity 0.15s', color: 'text.secondary' }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
