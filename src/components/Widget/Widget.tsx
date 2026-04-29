import { MoreVert as MoreIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem, Paper, Typography, Box, Divider } from '@mui/material';
import React, { useState } from 'react';

interface WidgetProps {
  children?: React.ReactNode;
  title?: string;
  noBodyPadding?: boolean;
  bodyClass?: string;
  disableWidgetMenu?: boolean;
  header?: React.ReactNode;
  sx?: any;
  bodySx?: any;
  upperTitle?: boolean;
  [key: string]: any;
}

export default function Widget({
  children,
  title,
  noBodyPadding,
  bodyClass,
  disableWidgetMenu,
  header,
  sx,
  bodySx,
  upperTitle,
  ...props
}: WidgetProps) {
  var [moreButtonRef, setMoreButtonRef] = useState<HTMLElement | null>(null);
  var [isMoreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            transform: 'translateY(-2px)',
          },
          ...(typeof sx === 'function' ? sx(theme) : sx),
        })}
      >
        <Box
          sx={{
            px: 2.5,
            pt: 2,
            pb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {header ? (
            header
          ) : (
            <React.Fragment>
              <Typography
                variant="subtitle2"
                sx={(theme) => ({
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.palette.text.disabled,
                })}
              >
                {title}
              </Typography>
              {!disableWidgetMenu && (
                <IconButton
                  size="small"
                  sx={(theme) => ({
                    color: theme.palette.text.disabled,
                    '&:hover': {
                      color: theme.palette.primary.main,
                      backgroundColor: 'transparent',
                    },
                  })}
                  aria-owns="widget-menu"
                  aria-haspopup="true"
                  onClick={(e) => {
                    setMoreButtonRef(e.currentTarget);
                    setMoreMenuOpen(true);
                  }}
                >
                  <MoreIcon fontSize="small" />
                </IconButton>
              )}
            </React.Fragment>
          )}
        </Box>
        <Divider />
        <Box
          className={bodyClass}
          sx={(theme) => ({
            p: 2.5,
            flexGrow: 1,
            ...(noBodyPadding && { p: 0 }),
            ...(typeof bodySx === 'function' ? bodySx(theme) : bodySx),
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
