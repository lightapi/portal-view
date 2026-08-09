import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Tab, Tabs, Typography } from '@mui/material';
import CodeMirror from '@uiw/react-codemirror';
import { githubLight } from '@uiw/codemirror-theme-github';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  convertOpenApiSpec,
  detectOpenApiSpecFormat,
  parseOpenApiSpec,
  type OpenApiSpecFormat,
} from './openApiSpecFormat';

type Props = {
  value: string;
  onChange?: (value: string) => void;
  onValidationChange?: (error: string | null) => void;
  readOnly?: boolean;
  height?: string;
};

export default function OpenApiSpecEditor({
  value,
  onChange,
  onValidationChange,
  readOnly = false,
  height = '520px',
}: Props) {
  const [sourceFormat, setSourceFormat] = useState<OpenApiSpecFormat>(() => detectOpenApiSpecFormat(value));
  const [format, setFormat] = useState<OpenApiSpecFormat>(sourceFormat);
  const [sourceValue, setSourceValue] = useState(value);
  const [editorValue, setEditorValue] = useState(value);
  const [sourceError, setSourceError] = useState<string | null>(
    () => parseOpenApiSpec(value, sourceFormat).error,
  );
  const [conversionError, setConversionError] = useState<string | null>(null);
  const lastEmittedValue = useRef(value);
  const isConvertedPreview = format !== sourceFormat;
  const editorReadOnly = readOnly || isConvertedPreview;

  useEffect(() => {
    onValidationChange?.(sourceError);
  }, [sourceError, onValidationChange]);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    const nextFormat = detectOpenApiSpecFormat(value);
    lastEmittedValue.current = value;
    setSourceFormat(nextFormat);
    setFormat(nextFormat);
    setSourceValue(value);
    setEditorValue(value);
    setSourceError(parseOpenApiSpec(value, nextFormat).error);
    setConversionError(null);
  }, [value]);

  const extensions = useMemo(() => [
    format === 'json' ? json() : yaml(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'OpenAPI specification source' }),
    ...(editorReadOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
  ], [editorReadOnly, format]);

  const handleFormatChange = (_event: unknown, nextFormat: OpenApiSpecFormat) => {
    setConversionError(null);
    if (nextFormat === format) return;
    if (nextFormat === sourceFormat) {
      setFormat(nextFormat);
      setEditorValue(sourceValue);
      return;
    }

    const converted = convertOpenApiSpec(sourceValue, sourceFormat, nextFormat);
    if (converted.error) {
      setConversionError(converted.error);
      return;
    }

    setFormat(nextFormat);
    setEditorValue(converted.value);
  };

  const applyConversion = () => {
    if (readOnly || !isConvertedPreview) return;
    setSourceFormat(format);
    setSourceValue(editorValue);
    setSourceError(null);
    setConversionError(null);
    lastEmittedValue.current = editorValue;
    onChange?.(editorValue);
  };

  const handleEditorChange = (nextValue: string) => {
    if (editorReadOnly) return;
    setEditorValue(nextValue);
    setSourceValue(nextValue);
    lastEmittedValue.current = nextValue;
    setSourceError(parseOpenApiSpec(nextValue, sourceFormat).error);
    setConversionError(null);
    onChange?.(nextValue);
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: 1,
        }}
      >
        <Tabs
          value={format}
          onChange={handleFormatChange}
          onClickCapture={() => setConversionError(null)}
          aria-label="OpenAPI specification format"
          sx={{ flex: 1 }}
        >
          <Tab value="yaml" label="YAML" />
          <Tab value="json" label="JSON" />
        </Tabs>
        {isConvertedPreview && !readOnly ? (
          <Button size="small" variant="outlined" onClick={applyConversion} sx={{ mr: 1 }}>
            Use {format.toUpperCase()} format
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
            {readOnly ? 'Read only' : `${sourceFormat.toUpperCase()} source`}
          </Typography>
        )}
      </Box>
      {(conversionError || sourceError) && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {conversionError || sourceError}
        </Alert>
      )}
      <CodeMirror
        value={editorValue}
        height={height}
        width="100%"
        theme={githubLight}
        extensions={extensions}
        editable={!editorReadOnly}
        onChange={handleEditorChange}
      />
      {!readOnly && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, py: 1 }}>
          {isConvertedPreview
            ? `Preview only. Choose “Use ${format.toUpperCase()} format” to replace the stored ${sourceFormat.toUpperCase()} source.`
            : 'Explicit format conversion can remove YAML comments, anchors, and original formatting.'}
        </Typography>
      )}
    </Box>
  );
}
