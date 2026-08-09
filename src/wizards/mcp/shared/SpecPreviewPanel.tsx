import { Box } from '@mui/material';
import OpenApiSpecEditor from '../../../components/OpenApiSpecEditor';

interface SpecPreviewPanelProps {
  value: string;
}

/** Renders a read-only YAML/JSON specification source viewer. */
export default function SpecPreviewPanel({ value }: SpecPreviewPanelProps) {
  return (
    <Box sx={{ bgcolor: 'background.paper' }}>
      <OpenApiSpecEditor value={value} readOnly height="480px" />
    </Box>
  );
}
