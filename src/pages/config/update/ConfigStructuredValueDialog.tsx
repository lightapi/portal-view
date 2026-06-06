import { useEffect, useMemo, useState } from 'react';
import { SchemaForm, utils } from 'react-schema-form';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { ConfigSchemaRef, ConfigUpdateProperty } from './types';
import { fetchSchemaByRef } from './configUpdateApi';
import { parseStructuredValue, structuredInitialValue, toPrettyJson, toYaml } from './configValue';
import {
  configValueFromFormModel,
  formModelFromConfigValue,
  formSchemaForConfigValue,
  parseCompactJsonValue,
  parseSchemaBody,
  schemaCompatibleWithValueType,
  validateConfigStructuredValue,
} from './configSchemaValidation';

type Props = {
  row: ConfigUpdateProperty | null;
  value: string;
  open: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
};

type DialogTab = 'json' | 'yaml' | 'form';

function firstErrorMessage(result: any) {
  if (!result) return 'Schema validation failed.';
  if (result.error) return result.error;
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors.map((error: any) => error?.message || String(error)).join('\n');
  }
  return 'Schema validation failed.';
}

function formErrorText(errors: string[]) {
  return errors.length > 0 ? errors.join('\n') : null;
}

export default function ConfigStructuredValueDialog({ row, value, open, onClose, onSave }: Props) {
  const [tab, setTab] = useState<DialogTab>('json');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [schemaRef, setSchemaRef] = useState<ConfigSchemaRef | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [formModel, setFormModel] = useState<any>({});
  const [showFormErrors, setShowFormErrors] = useState(false);

  const initialJson = useMemo(
    () => toPrettyJson(structuredInitialValue(row?.valueType, value)),
    [row?.valueType, value],
  );

  const parsedSchema = useMemo(() => {
    if (!schemaRef?.schemaBody) return null;
    const parsed = parseSchemaBody(schemaRef.schemaBody);
    if (parsed.error) return null;
    return parsed.schema;
  }, [schemaRef?.schemaBody]);

  const formSchema = useMemo(() => {
    if (!row || !parsedSchema || !schemaCompatibleWithValueType(parsedSchema, row.valueType)) return null;
    return formSchemaForConfigValue(parsedSchema, row.valueType);
  }, [parsedSchema, row]);

  const formTabEnabled = Boolean(formSchema && schemaRef?.schemaStatus === 'P');

  useEffect(() => {
    if (!open) return;
    setTab('json');
    setText(initialJson);
    setError(null);
    setSchemaError(null);
    setSchemaRef(null);
    setShowFormErrors(false);
    setFormModel({});
  }, [initialJson, open]);

  useEffect(() => {
    if (!open || !row?.hasSchema || !row.schemaId || !row.schemaVersion || row.schemaStatus !== 'P') return;
    let cancelled = false;
    setSchemaLoading(true);
    void fetchSchemaByRef(row)
      .then((schema) => {
        if (cancelled) return;
        setSchemaRef(schema);
      })
      .catch((fetchError: any) => {
        if (cancelled) return;
        setSchemaError(fetchError?.description || fetchError?.message || 'Schema lookup failed.');
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  if (!row) return null;

  const schemaValidationErrors = (compactJson: string) => (
    parsedSchema && schemaCompatibleWithValueType(parsedSchema, row.valueType)
      ? validateConfigStructuredValue(row, compactJson, parsedSchema)
      : validateConfigStructuredValue(row, compactJson, null)
  );

  const modelFromCompactJson = (compactJson: string) => {
    const parsed = parseCompactJsonValue(compactJson);
    if (parsed.error) return {};
    return formModelFromConfigValue(parsed.value, row.valueType);
  };

  const compactJsonFromForm = () => {
    if (!formSchema) return { error: 'No compatible schema form is available.' };
    const result = utils.validateBySchema(formSchema, formModel);
    if (!result.valid) return { error: firstErrorMessage(result) };
    const formValue = configValueFromFormModel(formModel, row.valueType);
    const compactJson = JSON.stringify(formValue);
    const validationErrors = schemaValidationErrors(compactJson);
    if (validationErrors.length > 0) return { error: formErrorText(validationErrors) };
    return { value: compactJson };
  };

  const compactJsonFromText = () => {
    const parsed = parseStructuredValue(row.valueType, text, tab === 'yaml' ? 'yaml' : 'json');
    if (parsed.error) return { error: parsed.error };
    const validationErrors = schemaValidationErrors(parsed.value ?? '');
    if (validationErrors.length > 0) return { error: formErrorText(validationErrors) };
    return { value: parsed.value ?? '' };
  };

  const currentCompactJson = () => (
    tab === 'form' ? compactJsonFromForm() : compactJsonFromText()
  );

  const handleTabChange = (_event: unknown, nextTab: DialogTab) => {
    if (nextTab === tab) return;
    if (nextTab === 'form' && !formTabEnabled) return;

    const current = nextTab === 'form' && tab !== 'form'
      ? parseStructuredValue(row.valueType, text, tab === 'yaml' ? 'yaml' : 'json')
      : currentCompactJson();
    if (current.error) {
      setError(current.error);
      return;
    }

    setError(null);
    setShowFormErrors(false);
    setTab(nextTab);
    if (nextTab === 'form') {
      setFormModel(modelFromCompactJson(current.value ?? ''));
      return;
    }
    setText(nextTab === 'yaml' ? toYaml(current.value ?? '') : toPrettyJson(current.value ?? ''));
  };

  const handleFormModelChange = (key: string | string[], val: any, type?: string) => {
    const next = { ...formModel };
    utils.selectOrSet(key, next, val, type);
    setFormModel(next);
    setShowFormErrors(false);
  };

  const handleSave = () => {
    const current = currentCompactJson();
    if (current.error) {
      setError(current.error);
      if (tab === 'form') setShowFormErrors(true);
      return;
    }
    onSave(current.value ?? '');
  };

  const schemaHint = row.hasSchema
    ? `${row.schemaId ?? ''}${row.schemaVersion ? `:${row.schemaVersion}` : ''}`
    : 'No schema attached';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {row.configName} / {row.propertyName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={handleTabChange}>
            <Tab value="json" label="JSON" />
            <Tab value="yaml" label="YAML" />
            <Tab value="form" label="Form" disabled={!formTabEnabled} />
          </Tabs>
        </Box>
        {schemaLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary">Loading schema...</Typography>
          </Box>
        )}
        {schemaError && <Alert severity="warning" sx={{ mb: 2 }}>{schemaError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}
        <Typography variant="caption" color="text.secondary">
          {row.valueType === 'list' ? 'Array value' : 'Object value'} stored as compact JSON. {schemaHint}
        </Typography>
        {tab === 'form' && formSchema ? (
          <Box sx={{ mt: 2 }}>
            <SchemaForm
              schema={formSchema}
              form={['*']}
              model={formModel}
              showErrors={showFormErrors}
              onModelChange={handleFormModelChange}
            />
          </Box>
        ) : (
          <TextField
            value={text}
            onChange={(event) => setText(event.target.value)}
            multiline
            minRows={14}
            fullWidth
            sx={{ mt: 1 }}
            spellCheck={false}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Stage Value</Button>
      </DialogActions>
    </Dialog>
  );
}
