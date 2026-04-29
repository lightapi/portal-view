import { Inbox as InboxIcon } from '@mui/icons-material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarLinkProps {
  link?: string;
  icon?: JSX.Element;
  label?: string;
  children?: any[];
  isSidebarOpened?: boolean;
  nested?: boolean;
  type?: string;
  defaultOpen?: boolean;
}

export default function SidebarLink({
  link,
  icon,
  label,
  children,
  isSidebarOpened,
  nested,
  type,
  defaultOpen = false,
}: SidebarLinkProps) {
  const location = useLocation();

  var [isOpen, setIsOpen] = useState(defaultOpen);
  var isLinkActive =
    link &&
    (location.pathname === link ||
      location.pathname.indexOf(link) !== -1 ||
      // Treat the wizard as part of the gateway section
      (link === '/app/mcp/gateway' && location.pathname.startsWith('/app/mcp/')));

  if (type === "title")
    return (
      <Typography
        sx={{
          marginLeft: (theme) => theme.spacing(4.5),
          marginTop: (theme) => theme.spacing(2),
          marginBottom: (theme) => theme.spacing(2),
          padding: 0,
          color: (theme) => theme.palette.text.secondary + "CC",
          transition: (theme) => theme.transitions.create(["opacity", "color"]),
          fontSize: 16,
          ...(!isSidebarOpened && { opacity: 0 }),
        }}
      >
        {label}
      </Typography>
    );

  if (type === "divider")
    return (
      <Divider
        sx={{
          marginTop: (theme) => theme.spacing(2),
          marginBottom: (theme) => theme.spacing(4),
          height: 1,
          backgroundColor: "#D8D8D880",
        }}
      />
    );

  if (type === "group")
    return (
      <>
        {!isSidebarOpened ? (
          <List disablePadding>
            {(children ?? []).map((child) => (
              <SidebarLink key={child.id ?? child.link ?? child.label} isSidebarOpened={false} nested={false} {...child} />
            ))}
          </List>
        ) : (
          <>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setIsOpen((o) => !o)}
                disableRipple
                sx={{
                  px: 1.5,
                  py: 0.5,
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {icon && (
                  <ListItemIcon sx={{ minWidth: 32, color: 'text.disabled' }}>
                    {icon as any}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={label}
                  sx={{
                    m: 0,
                    '& .MuiTypography-root': {
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'text.disabled',
                    },
                  }}
                />
                {isOpen ? <ExpandLess sx={{ fontSize: 16, color: 'text.disabled' }} /> : <ExpandMore sx={{ fontSize: 16, color: 'text.disabled' }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List disablePadding>
                {(children ?? []).map((child) => (
                  <SidebarLink key={child.id ?? child.link ?? child.label} isSidebarOpened={isSidebarOpened} nested={false} {...child} />
                ))}
              </List>
            </Collapse>
          </>
        )}
      </>
    );

  if (!children)
    return (
      <ListItem disablePadding>
        <ListItemButton
          component={link ? Link : ("div" as any)}
          to={link}
          sx={{
            textDecoration: "none",
            ...(!isSidebarOpened && !nested && { justifyContent: 'center', px: 0 }),
            "&:hover, &:focus": {
              backgroundColor: (theme) => (theme.palette.background as any).light,
            },
            ...(isLinkActive && {
                backgroundColor: (theme) =>
                  (theme.palette.background as any).light,
              }),
            ...(nested && {
              position: 'relative',
              paddingLeft: '20px',
              "&::before": {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '50%',
                width: '12px',
                borderTop: '1px solid',
                borderColor: 'divider',
              },
            }),
          }}
          disableRipple
        >
          {!nested && (
            <ListItemIcon
              sx={{
                marginRight: isSidebarOpened ? (theme) => theme.spacing(nested ? 0.5 : 1) : 0,
                color: (theme) =>
                  isLinkActive
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary + "99",
                transition: (theme) => theme.transitions.create("color"),
                minWidth: nested ? 16 : 24,
                width: nested ? 16 : 24,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {icon as any}
            </ListItemIcon>
          )}
          {isSidebarOpened && (
            <ListItemText
              sx={{
                margin: 0,
                "& .MuiTypography-root": {
                  padding: 0,
                  color: (theme) =>
                    isLinkActive
                      ? theme.palette.text.primary
                      : theme.palette.text.secondary + "CC",
                  transition: (theme) =>
                    theme.transitions.create(["opacity", "color"]),
                  fontSize: nested ? 13 : 16,
                },
              }}
              primary={label}
            />
          )}
        </ListItemButton>
      </ListItem>
    );

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          component={link ? Link : ("div" as any)}
          onClick={toggleCollapse}
          to={link}
          sx={{
            textDecoration: "none",
            ...(!isSidebarOpened && { justifyContent: 'center', px: 0 }),
            "&:hover, &:focus": {
              backgroundColor: (theme) => (theme.palette.background as any).light,
            },
            ...(isLinkActive &&
              !nested && {
                backgroundColor: (theme) =>
                  (theme.palette.background as any).light,
              }),
            ...(nested && {
              paddingLeft: 0,
              "&:hover, &:focus": {
                backgroundColor: "#FFFFFF",
              },
            }),
          }}
          disableRipple
        >
          <ListItemIcon
            sx={{
              marginRight: isSidebarOpened ? (theme) => theme.spacing(1) : 0,
              color: (theme) =>
                isLinkActive
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary + "99",
              transition: (theme) => theme.transitions.create("color"),
              minWidth: 24,
              width: 24,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {icon ? (icon as any) : <InboxIcon />}
          </ListItemIcon>
          {isSidebarOpened && (
            <ListItemText
              sx={{
                margin: 0,
                "& .MuiTypography-root": {
                  padding: 0,
                  color: (theme) =>
                    isLinkActive
                      ? theme.palette.text.primary
                      : theme.palette.text.secondary + "CC",
                  transition: (theme) =>
                    theme.transitions.create(["opacity", "color"]),
                  fontSize: 16,
                },
              }}
              primary={label}
            />
          )}
        </ListItemButton>
      </ListItem>
      {children && (
        <Collapse
          in={isOpen && isSidebarOpened}
          timeout="auto"
          unmountOnExit
          sx={{
            ml: '28px',
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}
        >
          <List component="div" disablePadding>
            {children.map((childrenLink) => (
              <SidebarLink
                key={childrenLink && childrenLink.link}
                isSidebarOpened={isSidebarOpened}
                nested
                {...childrenLink}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );

  function toggleCollapse(e: React.MouseEvent) {
    if (isSidebarOpened) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  }
}