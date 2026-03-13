import {
  Badge as BadgeBase,
  Button as ButtonBase,
  Typography as TypographyBase,
  useTheme,
} from "@mui/material";
import React from "react";

// styles
interface BadgeProps {
  children?: React.ReactNode;
  colorBrightness?: string;
  color?: string;
  [x: string]: any;
}

function Badge({ children, colorBrightness, color, ...props }: BadgeProps) {
  const theme = useTheme();

  return (
    <BadgeBase
      sx={{
        "& .MuiBadge-badge": {
          fontWeight: 600,
          height: 16,
          minWidth: 16,
          backgroundColor: getColor(color, theme, colorBrightness),
        },
      }}
      {...props}
    >
      {children}
    </BadgeBase>
  );
}

interface TypographyProps {
  children: React.ReactNode;
  weight?: "light" | "medium" | "bold";
  size?: "sm" | "md" | "xl" | "xxl";
  colorBrightness?: string;
  color?: string;
  variant?: any;
  [x: string]: any;
}

function Typography({
  children,
  weight,
  size,
  colorBrightness,
  color,
  ...props
}: TypographyProps) {
  const theme = useTheme();

  return (
    <TypographyBase
      sx={{
        color: getColor(color, theme, colorBrightness),
        fontWeight: getFontWeight(weight),
        fontSize: getFontSize(size, props.variant, theme),
      }}
      {...props}
    >
      {children}
    </TypographyBase>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  select?: boolean;
  [x: string]: any;
}

function Button({ children, color, className, ...props }: ButtonProps) {
  const theme = useTheme();

  return (
    <ButtonBase
      sx={{
        color: getColor(color, theme),
        "&.MuiButton-contained": {
          backgroundColor: getColor(color, theme),
          boxShadow: (theme as any).customShadows?.widget,
          color: `${color ? "white" : theme.palette.text.primary} !important`,
          "&:hover": {
            backgroundColor: getColor(color, theme, "light"),
            boxShadow: (theme as any).customShadows?.widgetWide,
          },
          "&:active": {
            boxShadow: (theme as any).customShadows?.widgetWide,
          },
        },
        "&.MuiButton-outlined": {
          color: getColor(color, theme),
          borderColor: getColor(color, theme),
        },
        ...(props.select && {
          backgroundColor: theme.palette.primary.main,
          color: "#fff",
        }),
      }}
      className={className}
      {...props}
    >
      {children}
    </ButtonBase>
  );
}

export { Badge, Typography, Button };

// ########################################################################

function getColor(color: string | undefined, theme: any, brigtness = "main") {
  if (color && theme.palette[color] && theme.palette[color][brigtness]) {
    return theme.palette[color][brigtness];
  }
}

function getFontWeight(style?: string) {
  switch (style) {
    case "light":
      return 300;
    case "medium":
      return 500;
    case "bold":
      return 600;
    default:
      return 400;
  }
}

function getFontSize(size: string | undefined, variant = "", theme: any) {
  var multiplier;

  switch (size) {
    case "sm":
      multiplier = 0.8;
      break;
    case "md":
      multiplier = 1.5;
      break;
    case "xl":
      multiplier = 2;
      break;
    case "xxl":
      multiplier = 3;
      break;
    default:
      multiplier = 1;
      break;
  }

  var defaultSize =
    variant && theme.typography[variant]
      ? theme.typography[variant].fontSize
      : theme.typography.fontSize + (typeof theme.typography.fontSize === 'number' ? 'px' : '');

  return `calc(${defaultSize} * ${multiplier})`;
}
