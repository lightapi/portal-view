import {
  AccountBox as CustomerIcon,
  AcUnit as CovidIcon,
  BusinessCenter as DeliveredIcon,
  DiscFull as DiscIcon,
  Done as ShippedIcon,
  Email as MessageIcon,
  Error as DefenceIcon,
  NotificationsNone as NotificationsIcon,
  Publish as UploadIcon,
  Report as ReportIcon,
  ShoppingCart as ShoppingCartIcon,
  SmsFailed as FeedbackIcon,
} from '@mui/icons-material';
import { Button, useTheme, Typography, SxProps, Theme } from "@mui/material";
import React from "react";
import tinycolor from "tinycolor2";
import { timeConversion } from "../../utils";

// styles
import {
  NotificationRoot,
  IconContainer,
  MessageContainer,
} from "./NotificationStyles";

const typesIcons: any = {
  "e-commerce": <ShoppingCartIcon />,
  notification: <NotificationsIcon />,
  user: <CustomerIcon />,
  covid: <CovidIcon />,
  message: <MessageIcon />,
  feedback: <FeedbackIcon />,
  customer: <CustomerIcon />,
  shipped: <ShippedIcon />,
  delivered: <DeliveredIcon />,
  defence: <DefenceIcon />,
  report: <ReportIcon />,
  upload: <UploadIcon />,
  disc: <DiscIcon />,
};

interface NotificationProps {
  variant?: "contained" | "rounded";
  success?: boolean;
  app?: string;
  type?: string;
  className?: string;
  shadowless?: boolean;
  color?: string;
  typographyVariant?: any;
  name?: string;
  message?: string;
  event?: { timestamp: number };
  extraButton?: string;
  extraButtonClick?: () => void;
  sx?: SxProps<Theme>;
}

export default function Notification({
  variant,
  sx,
  ...props
}: NotificationProps) {
  const theme = useTheme();
  
  const type = props.type || props.app || "notification";
  const colorName = props.color || (props.success ? "success" : "error");
  const message = props.message || props.name || "";
  const timestamp = props.event?.timestamp || new Date().getTime();

  const icon = typesIcons[type] || <NotificationsIcon />;
  const iconWithStyles = React.cloneElement(icon, {
    style: {
      color:
        variant !== "contained" &&
        (theme.palette as any)[colorName] &&
        (theme.palette as any)[colorName].main,
    },
  });

  return (
    <NotificationRoot
      variant={variant}
      shadowless={props.shadowless}
      colorName={colorName}
      className={props.className}
      sx={sx}
    >
      <IconContainer
        notificationType={type}
        variant={variant as any}
        colorName={colorName}
        sx={{
          backgroundColor:
            variant === "rounded" &&
            colorName &&
            (theme.palette as any)[colorName] &&
            tinycolor((theme.palette as any)[colorName].main)
              .setAlpha(0.15)
              .toRgbString(),
        }}
      >
        {iconWithStyles}
      </IconContainer>
      <MessageContainer>
        <Typography
          sx={{
            ...(variant === "contained" && { color: "white" }),
            ...(variant !== "contained" && !props.typographyVariant && { fontSize: '1.5rem' })
          }}
          variant={props.typographyVariant}
        >
          {message}{" "}
          {timeConversion(new Date().getTime() - timestamp)}
        </Typography>
        {props.extraButton && props.extraButtonClick && (
          <Button
            onClick={props.extraButtonClick}
            disableRipple
            sx={{
              color: "white",
              "&:hover, &:focus": {
                background: "transparent",
              },
            }}
          >
            {props.extraButton}
          </Button>
        )}
      </MessageContainer>
    </NotificationRoot>
  );
}
