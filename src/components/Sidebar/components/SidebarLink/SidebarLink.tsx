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
import classnames from 'classnames';
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
// components
import Dot from '../Dot';
// styles
import useStyles from './styles';

export default function SidebarLink({
  link,
  icon,
  label,
  children,
  isSidebarOpened,
  nested,
  type,
}) {
  var classes = useStyles();
  const location = useLocation();

  // local
  var [isOpen, setIsOpen] = useState(false);
  var isLinkActive =
    link &&
    (location.pathname === link || location.pathname.indexOf(link) !== -1);

  if (type === 'title')
    return (
      <Typography
        className={classnames(classes.linkText, classes.sectionTitle, {
          [classes.linkTextHidden]: !isSidebarOpened,
        })}
      >
        {label}
      </Typography>
    );

  if (type === 'divider') return <Divider className={classes.divider} />;

  if (!children)
    return (
      <ListItem disablePadding>
        <ListItemButton
          component={link ? Link : 'div'}
          to={link}
          sx={{
            root: classnames(classes.linkRoot, {
              [classes.linkActive]: isLinkActive && !nested,
              [classes.linkNested]: nested,
            }),
          }}
          disableRipple
        >
          <ListItemIcon
            className={classnames(classes.linkIcon, {
              [classes.linkIconActive]: isLinkActive,
            })}
          >
            {nested ? <Dot color={isLinkActive && 'primary'} /> : icon}
          </ListItemIcon>
          <ListItemText
            classes={{
              primary: classnames(classes.linkText, {
                [classes.linkTextActive]: isLinkActive,
                [classes.linkTextHidden]: !isSidebarOpened,
              }),
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
          component={link ? Link : 'div'}
          onClick={toggleCollapse}
          to={link}
          sx={{
            root: classnames(classes.linkRoot, {
              [classes.linkActive]: isLinkActive && !nested,
              [classes.linkNested]: nested,
            }),
          }}
          disableRipple
        >
          <ListItemIcon
            className={classnames(classes.linkIcon, {
              [classes.linkIconActive]: isLinkActive,
            })}
          >
            {icon ? icon : <InboxIcon />}
          </ListItemIcon>
          <ListItemText
            classes={{
              primary: classnames(classes.linkText, {
                [classes.linkTextActive]: isLinkActive,
                [classes.linkTextHidden]: !isSidebarOpened,
              }),
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
          className={classes.nestedList}
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

  function toggleCollapse(e) {
    if (isSidebarOpened) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  }
}