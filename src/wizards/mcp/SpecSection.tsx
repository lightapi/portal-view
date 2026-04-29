import { useRef, useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { tryParseDoc } from './shared/parseSpec';
import SpecPreviewPanel from './shared/SpecPreviewPanel';
import type { CreateApiVersionForm } from './types';

interface SpecSectionProps {
  form: CreateApiVersionForm;
  patch: (p: Partial<CreateApiVersionForm>) => void;
}

/**
 * Collapsible OpenAPI spec upload + SwaggerUI preview section.
 * Only rendered when mode !== 'server'.
 */
export default function SpecSection({ form, patch }: SpecSectionProps) {
  const [specOpen, setSpecOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSpec = form.spec.trim().length > 0;
  const parsedDoc = useMemo(() => (hasSpec ? tryParseDoc(form.spec) : null), [form.spec, hasSpec]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.json')) {
      setParseError('JSON specs are not supported — please upload a YAML file (.yaml or .yml).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = tryParseDoc(text);
      if (!parsed) { setParseError('Could not parse file — make sure it is valid YAML.'); return; }
      setParseError(null);
      patch({ spec: text });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: hasSpec ? 'success.light' : 'divider',
        borderRadius: 2, overflow: 'hidden',
      }}
    >
      <input ref={fileInputRef} type="file" accept=".yaml,.yml" hidden onChange={handleFileChange} />

      <Box
        onClick={() => setSpecOpen((o) => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.5,
          cursor: 'pointer',
          bgcolor: (t) => hasSpec ? alpha(t.palette.success.main, 0.07) : alpha(t.palette.primary.main, 0.06),
          borderBottom: specOpen ? '1px solid' : 'none', borderColor: 'divider',
          userSelect: 'none',
          '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.06) },
        }}
      >
        <Box sx={{ color: hasSpec ? 'success.main' : 'primary.main', display: 'flex' }}>
          {hasSpec ? <CheckCircleOutlineIcon /> : <CodeOutlinedIcon />}
        </Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>Specification</Typography>
        {hasSpec && <Chip label="Loaded" size="small" color="success" variant="outlined" />}
        <Box sx={{ color: 'text.secondary', display: 'flex', ml: 1 }}>
          {specOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      <Collapse in={specOpen}>
        {hasSpec && parsedDoc ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 3, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              {parseError && <Typography variant="caption" color="error" sx={{ flex: 1 }}>{parseError}</Typography>}
              <Button size="small" variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Replace
              </Button>
            </Box>
            <SpecPreviewPanel spec={parsedDoc} />
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, p: 5, textAlign: 'center' }}>
            <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              No specification attached. Upload a YAML file (.yaml, .yml) to preview it here and have endpoints auto-generated on submit.
            </Typography>
            {parseError && <Typography variant="caption" color="error">{parseError}</Typography>}
            <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Upload spec
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
