import { Box, Tab, Tabs, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { FlowStep, WizardCtx } from '../flowConfig';

interface WizardTabBarProps {
  flow: { steps: FlowStep[] };
  step: number;
  maxStep: number;
  ctx: WizardCtx;
  onChange: (step: number) => void;
}

/** Horizontal step tab strip shown above the wizard content area. */
export default function WizardTabBar({ flow, step, maxStep, ctx, onChange }: WizardTabBarProps) {
  return (
    <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', px: 3 }}>
      <Tabs
        value={step - 1}
        onChange={(_, v) => onChange(v + 1)}
        variant="scrollable"
        scrollButtons="auto"
        TabIndicatorProps={{ style: { display: 'none' } }}
        sx={{ minHeight: 44, gap: 0.5, '& .MuiTabs-flexContainer': { gap: 0.5 } }}
      >
        {flow.steps.map((s: FlowStep, idx: number) => {
          // A step is done if its predicate says so, OR if the wizard jumped past it
          // (e.g. arriving via deep-link with preInstanceApiId skips steps 1–5).
          const stepNum = idx + 1;
          const done = s.isDone(ctx) || (stepNum < step && stepNum <= maxStep);
          const isActive = idx === step - 1;
          return (
            <Tab
              key={s.label}
              disabled={idx + 1 > maxStep}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: '50%',
                      bgcolor: done ? 'success.main' : isActive ? 'primary.main' : 'action.selected',
                      color: done || isActive ? '#fff' : 'text.secondary',
                      flexShrink: 0, transition: 'background-color 0.2s',
                    }}
                  >
                    {done ? s.doneIcon : s.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isActive ? 700 : 500, fontSize: '0.78rem',
                      color: isActive ? 'primary.main' : done ? 'text.primary' : 'text.secondary',
                      transition: 'color 0.2s',
                    }}
                  >
                    {s.label}
                  </Typography>
                </Box>
              }
              sx={{
                minHeight: 44, px: 1.5, py: 0, textTransform: 'none',
                borderRadius: '8px 8px 0 0',
                bgcolor: isActive ? (t) => alpha(t.palette.primary.main, 0.07) : 'transparent',
                '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                '&.Mui-disabled': { opacity: 0.4 },
              }}
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
