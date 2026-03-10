import { MoreVert as MoreIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem, Paper, Typography } from '@mui/material';
import classnames from 'classnames';
import React, { useState } from 'react';
// styles
import useStyles from './styles';

interface WidgetProps {
  children?: React.ReactNode;
  title?: string;
  noBodyPadding?: boolean;
  bodyClass?: string;
  disableWidgetMenu?: boolean;
  header?: React.ReactNode;
  [key: string]: any;
}

export default function Widget({
  children,
  title,
  noBodyPadding,
  bodyClass,
  disableWidgetMenu,
  header,
  ...props
}: WidgetProps) {
  var classes = useStyles();

  // local
  var [moreButtonRef, setMoreButtonRef] = useState<HTMLElement | null>(null);
  var [isMoreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <div className={classes.widgetWrapper}>
      <Paper className={classes.paper} classes={{ root: classes.widgetRoot }}>
        <div className={classes.widgetHeader}>
          {header ? (
            header
          ) : (
            <React.Fragment>
              <Typography variant="h5" color="textSecondary">
                {title}
              </Typography>
              {!disableWidgetMenu && (
                <IconButton
                  color="primary"
                  classes={{ root: classes.moreButton }}
                  aria-owns="widget-menu"
                  aria-haspopup="true"
                  onClick={() => setMoreMenuOpen(true)}
                  ref={setMoreButtonRef}
                  size="large">
                  <MoreIcon />
                </IconButton>
              )}
            </React.Fragment>
          )}
        </div>
        <div
          className={classnames(classes.widgetBody, bodyClass, {
            [classes.noPadding]: noBodyPadding,
          })}
        >
          {children}
        </div>
      </Paper>
      <Menu
        id="widget-menu"
        open={isMoreMenuOpen}
        anchorEl={moreButtonRef}
        onClose={() => setMoreMenuOpen(false)}
        disableAutoFocusItem
      >
        <MenuItem>
          <Typography>Edit</Typography>
        </MenuItem>
        <MenuItem>
          <Typography>Copy</Typography>
        </MenuItem>
        <MenuItem>
          <Typography>Delete</Typography>
        </MenuItem>
        <MenuItem>
          <Typography>Print</Typography>
        </MenuItem>
      </Menu>
    </div>
  );
}
