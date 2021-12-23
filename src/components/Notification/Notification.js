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
import { Button } from '@mui/material';
import { useTheme } from '@mui/styles';
import classnames from 'classnames';
import React from 'react';
import tinycolor from 'tinycolor2';
import { timeConversion } from '../../utils';
// components
import { Typography } from '../Wrappers';
// styles
import useStyles from './styles';

const typesIcons = {
  'e-commerce': <ShoppingCartIcon />,
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

export default function Notification({ variant, ...props }) {
  console.log('variant = ', variant);
  var classes = useStyles();
  var theme = useTheme();
  const color = props.success ? 'success' : 'error';
  const icon = getIconByType(props.app || 'user');
  const iconWithStyles = React.cloneElement(icon, {
    classes: {
      root: classes.notificationIcon,
    },
    style: {
      color:
        variant !== 'contained' &&
        theme.palette[color] &&
        theme.palette[color].main,
    },
  });

  return (
    <div
      className={classnames(classes.notificationContainer, props.className, {
        [classes.notificationContained]: variant === 'contained',
        [classes.notificationContainedShadowless]: props.shadowless,
      })}
      style={{
        backgroundColor:
          variant === 'contained' &&
          theme.palette[props.color] &&
          theme.palette[props.color].main,
      }}
    >
      <div
        className={classnames(classes.notificationIconContainer, {
          [classes.notificationIconContainerContained]: variant === 'contained',
          [classes.notificationIconContainerRounded]: variant === 'rounded',
        })}
        style={{
          backgroundColor:
            variant === 'rounded' &&
            theme.palette[props.color] &&
            tinycolor(theme.palette[props.color].main)
              .setAlpha(0.15)
              .toRgbString(),
        }}
      >
        {iconWithStyles}
      </div>
      <div className={classes.messageContainer}>
        <Typography
          className={classnames({
            [classes.containedTypography]: variant === 'contained',
          })}
          variant={props.typographyVariant}
          size={variant !== 'contained' && !props.typographyVariant && 'md'}
        >
          {props.name}{' '}
          {timeConversion(new Date().getTime() - props.event.timestamp)}
        </Typography>
        {props.extraButton && props.extraButtonClick && (
          <Button
            onClick={props.extraButtonClick}
            disableRipple
            className={classes.extraButton}
          >
            {props.extraButton}
          </Button>
        )}
      </div>
    </div>
  );
}

// ####################################################################
function getIconByType(type = 'offer') {
  return typesIcons[type];
}
