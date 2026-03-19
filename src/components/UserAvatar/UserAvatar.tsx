import { Box, Typography } from "@mui/material";
import React from "react";

interface UserAvatarProps {
  color?: string;
  name: string;
}

export default function UserAvatar({ color = "primary", name }: UserAvatarProps) {
  const letters = name
    .split(" ")
    .map((word) => word[0])
    .join("");

  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        backgroundColor: (theme) => (theme.palette as any)[color].main,
      }}
    >
      <Typography sx={{ color: "white" }}>{letters}</Typography>
    </Box>
  );
}
