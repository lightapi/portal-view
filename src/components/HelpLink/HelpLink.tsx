import { Button, Tooltip } from "@mui/material";
import type { ButtonProps, SxProps, Theme } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { buildPortalHelpUrl } from "../../utils/helpLinks";

type HelpLinkProps = {
  helpPath?: string | null;
  label?: string;
  tooltip?: string;
  fallback?: boolean;
  buttonVariant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  sx?: SxProps<Theme>;
};

export default function HelpLink({
  helpPath,
  label = "Help",
  tooltip,
  fallback = true,
  buttonVariant = "outlined",
  size = "small",
  sx,
}: HelpLinkProps) {
  if (!fallback && !helpPath?.trim()) return null;

  const url = buildPortalHelpUrl(helpPath);
  const sxValues = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Tooltip title={tooltip ?? label}>
      <Button
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        size={size}
        variant={buttonVariant}
        startIcon={<HelpOutlineIcon />}
        endIcon={<OpenInNewIcon fontSize="inherit" />}
        aria-label={tooltip ?? label}
        sx={[{ textTransform: "none", flexShrink: 0 }, ...sxValues]}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
