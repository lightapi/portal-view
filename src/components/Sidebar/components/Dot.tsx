import { Box, useTheme } from "@mui/material";
import React from "react";

interface DotProps {
  size?: "small" | "large" | "medium";
  color?: string;
}

export default function Dot({ size, color }: DotProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: size === "large" ? 8 : 5,
        height: size === "large" ? 8 : 5,
        backgroundColor: (theme) =>
          color && (theme.palette as any)[color]
            ? (theme.palette as any)[color].main
            : (theme.palette.text as any).hint,
        borderRadius: "50%",
        transition: theme.transitions.create("background-color"),
      }}
    />
  );
}
