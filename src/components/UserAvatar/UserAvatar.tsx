import { useTheme } from '@mui/styles';
import React from 'react';
// components
import { Typography } from '../Wrappers/Wrappers';
// styles
import useStyles from './styles';

export default function UserAvatar({ color = 'primary', ...props }) {
  var classes = useStyles();
  var theme = useTheme();

  var letters = props.name
    .split(' ')
    .map((word) => word[0])
    .join('');

  return (
    <div
      className={classes.avatar}
      style={{ backgroundColor: theme.palette[color].main }}
    >
      <Typography className={classes.text}>{letters}</Typography>
    </div>
  );
}
