import { MoreVert as MoreIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem, Paper, Typography, Box } from '@mui/material';
import React, { useState } from 'react';

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
  var [moreButtonRef, setMoreButtonRef] = useState<HTMLElement | null>(null);
  var [isMoreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      <Paper
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflow: 'hidden',
          boxShadow: (theme as any).customShadows?.widget,
        })}
      >
        <Box
          sx={(theme) => ({
            p: 3,
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
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
                  sx={(theme) => ({
                    m: -1,
                    p: 0,
                    width: 40,
                    height: 40,
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.main,
                      color: 'rgba(255, 255, 255, 0.35)',
                    },
                  })}
                  aria-owns="widget-menu"
                  aria-haspopup="true"
                  onClick={(e) => {
                    setMoreButtonRef(e.currentTarget);
                    setMoreMenuOpen(true);
                  }}
                  size="large"
                >
                  <MoreIcon />
                </IconButton>
              )}
            </React.Fragment>
          )}
        </Box>
        <Box
          className={bodyClass}
          sx={(theme) => ({
            pb: 3,
            pr: 3,
            pl: 3,
            ...(noBodyPadding && { p: 0 }),
          })}
        >
          {children}
        </Box>
      </Paper>
      <Menu
        id="widget-menu"
        open={isMoreMenuOpen}
        anchorEl={moreButtonRef}
        onClose={() => setMoreMenuOpen(false)}
        disableAutoFocusItem
      >
        <MenuItem onClick={() => setMoreMenuOpen(false)}>
          <Typography>Edit</Typography>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuOpen(false)}>
          <Typography>Copy</Typography>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuOpen(false)}>
          <Typography>Delete</Typography>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuOpen(false)}>
          <Typography>Print</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
