import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { yaml as yamlLanguage } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';

export const YAML_DIFF_SCAN_LIMIT = 500;
export const YAML_DIFF_TIMEOUT_MS = 750;

export function snapshotYamlDiffExtensions(wrap: boolean): Extension[] {
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    yamlLanguage(),
    oneDark,
    ...(wrap ? [EditorView.lineWrapping] : []),
  ];
}

