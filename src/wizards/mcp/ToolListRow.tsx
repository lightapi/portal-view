import { Box, Checkbox, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import type { McpToolType } from './types';

interface ToolListRowProps {
  tool: McpToolType;
  isSelected: boolean;
  isEditing: boolean;
  editDraft: { name: string; description: string };
  onToggle: (name: string) => void;
  onStartEdit: (e: React.MouseEvent, tool: McpToolType) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditDraftChange: (draft: { name: string; description: string }) => void;
}

/** Single tool row in SelectMcpToolsStep — handles both view mode and inline edit mode. */
export default function ToolListRow({
  tool, isSelected, isEditing, editDraft,
  onToggle, onStartEdit, onSaveEdit, onCancelEdit, onEditDraftChange,
}: ToolListRowProps) {
  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, px: 2, py: 1.5, bgcolor: (t) => alpha(t.palette.warning.main, 0.05) }}>
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(tool.name)}
          size="small"
          sx={{ mt: 0.5, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            size="small"
            label="Tool name"
            value={editDraft.name}
            onChange={(e) => onEditDraftChange({ ...editDraft, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            fullWidth
            autoFocus
          />
          <TextField
            size="small"
            label="Description"
            value={editDraft.description}
            onChange={(e) => onEditDraftChange({ ...editDraft, description: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancelEdit(); }}
            fullWidth
            multiline
            minRows={2}
          />
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
        onChange={() => onToggle(tool.name)}
        onClick={(e) => e.stopPropagation()}
        size="small"
        sx={{ flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} fontFamily="monospace" noWrap>
          {tool.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {tool.description || <Box component="span" sx={{ fontStyle: 'italic', opacity: 0.45 }}>No description</Box>}
        </Typography>
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
