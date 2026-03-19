import { Inbox as InboxIcon } from '@mui/icons-material';
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
// components
import Dot from "../Dot";

interface SidebarLinkProps {
  link?: string;
  icon?: JSX.Element;
  label?: string;
  children?: any[];
  isSidebarOpened?: boolean;
  nested?: boolean;
  type?: string;
}

export default function SidebarLink({
  link,
  icon,
  label,
  children,
  isSidebarOpened,
  nested,
  type,
}: SidebarLinkProps) {
  const location = useLocation();

  // local
  var [isOpen, setIsOpen] = useState(false);
  var isLinkActive =
    link &&
    (location.pathname === link || location.pathname.indexOf(link) !== -1);

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

  if (!children)
    return (
      <ListItem disablePadding>
        <ListItemButton
          component={link ? Link : ("div" as any)}
          to={link}
          sx={{
            textDecoration: "none",
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
              marginRight: (theme) => theme.spacing(1),
              color: (theme) =>
                isLinkActive
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary + "99",
              transition: (theme) => theme.transitions.create("color"),
              width: 24,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {nested ? <Dot color={isLinkActive ? "primary" : undefined} /> : (icon as any)}
          </ListItemIcon>
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
                ...(!isSidebarOpened && { opacity: 0 }),
              },
            }}
            primary={label}
          />
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
              marginRight: (theme) => theme.spacing(1),
              color: (theme) =>
                isLinkActive
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary + "99",
              transition: (theme) => theme.transitions.create("color"),
              width: 24,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {icon ? (icon as any) : <InboxIcon />}
          </ListItemIcon>
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
                ...(!isSidebarOpened && { opacity: 0 }),
              },
            }}
            primary={label}
          />
        </ListItemButton>
      </ListItem>
      {children && (
        <Collapse
          in={isOpen && isSidebarOpened}
          timeout="auto"
          unmountOnExit
          sx={{
            paddingLeft: (theme) => `calc(${theme.spacing(2)} + 30px)`,
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