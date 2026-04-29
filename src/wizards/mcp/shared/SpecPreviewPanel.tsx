import { Box } from '@mui/material';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface SpecPreviewPanelProps {
  spec: object;
}

/** Renders a SwaggerUI spec viewer with house font-family applied. */
export default function SpecPreviewPanel({ spec }: SpecPreviewPanelProps) {
  return (
    <Box sx={{ '& .swagger-ui': { fontFamily: 'inherit' } }}>
      <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={-1} />
    </Box>
  );
}
