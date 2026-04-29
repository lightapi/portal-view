import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Fade,
  Grow,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { parseSpec, formatBytes } from './shared/parseSpec';
import type { SpecPreview } from './shared/parseSpec';
import SpecPreviewPanel from './shared/SpecPreviewPanel';
import type { CreateApiForm, CreateApiVersionForm } from './types';

interface Props {
  patch: (p: Partial<CreateApiForm>) => void;
  patchVersion: (p: Partial<CreateApiVersionForm>) => void;
}

export default function UploadSpecStep({ patch, patchVersion }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpecPreview | null>(null);

  const processFile = (file: File) => {
    setParseError(null);
    setPreview(null);
    if (file.name.endsWith('.json')) {
      setParseError('JSON specs are not supported — please upload a YAML file (.yaml or .yml).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseSpec(text, file.name);
        setPreview(parsed);
        const updates: Partial<CreateApiForm> = {};
        if (parsed.apiName) updates.apiName = parsed.apiName;
        if (parsed.apiDesc) updates.apiDesc = parsed.apiDesc;
        if (parsed.gitRepo) updates.gitRepo = parsed.gitRepo;
        if (parsed.apiTags?.length) updates.apiTags = parsed.apiTags;
        patch(updates);

        const versionUpdates: Partial<CreateApiVersionForm> = { spec: text };
        if (parsed.apiVersion) versionUpdates.apiVersion = parsed.apiVersion;
        if (parsed.apiType) versionUpdates.apiType = parsed.apiType;
        patchVersion(versionUpdates);
      } catch (err: any) {
        setParseError(err.message ?? 'Failed to parse specification.');
      }
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <Stack spacing={3}>
      {/* Drop zone */}
      <Paper
        variant="outlined"
        onClick={() => !preview && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={{
          borderRadius: 2,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? 'primary.main' : 'divider',
          bgcolor: (t) =>
            dragging ? alpha(t.palette.primary.main, 0.06) : 'background.paper',
          cursor: preview ? 'default' : 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
          p: 6,
          textAlign: 'center',
          ...(!preview && {
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            },
          }),
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".yaml,.yml"
          hidden
          onChange={onFileChange}
        />
        <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          Drop your OpenAPI spec here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          or <Box component="span" sx={{ color: 'primary.main', textDecoration: 'underline' }}>browse</Box> · YAML only (.yaml, .yml)
        </Typography>
      </Paper>

      {parseError && <Alert severity="error">{parseError}</Alert>}

      {/* Spec viewer */}
      <Grow in={!!preview} timeout={350} style={{ transformOrigin: 'top center' }}>
        <Fade in={!!preview} timeout={400}>
          {/* Fade/Grow need a single DOM child — wrap in a div that hides when no preview */}
          <div style={{ display: preview ? undefined : 'none' }}>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              {/* Toolbar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 3,
                  py: 1.5,
                  bgcolor: (t) => alpha(t.palette.success.main, 0.08),
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <CheckCircleOutlineIcon sx={{ color: 'success.main' }} />
                <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                  {preview?.rawFileName}
                  <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 1 }}>
                    · {preview && formatBytes(preview.rawSize)}
                  </Box>
                </Typography>
                <Button size="small" variant="outlined" onClick={() => inputRef.current?.click()}>
                  Replace
                </Button>
              </Box>

              {/* SwaggerUI viewer */}
              {preview && <SpecPreviewPanel spec={preview.parsedDoc} />}
            </Paper>
          </div>
        </Fade>
      </Grow>
    </Stack>
  );
}
