import { Button, Box, Theme } from "@mui/material";
import { Typography } from "../Wrappers/Wrappers";

interface PageTitleProps {
  title: string;
  button?: string;
}

export default function PageTitle(props: PageTitleProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mb: 4,
        mt: 5,
      }}
    >
      <Typography
        sx={(theme: Theme) => ({ color: theme.palette.text.secondary })}
        variant="h4"
        size="sm"
      >
        {props.title}
      </Typography>
      {props.button && (
        <Button
          sx={(theme) => ({
            boxShadow: (theme as any).customShadows?.widget,
            textTransform: 'none',
            '&:active': {
              boxShadow: (theme as any).customShadows?.widgetWide,
            },
          })}
          variant="contained"
          size="large"
          color="secondary"
        >
          {props.button}
        </Button>
      )}
    </Box>
  );
}
