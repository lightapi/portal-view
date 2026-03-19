import {
  Book,
  ContactMail,
  EventSeat,
  Home as HomeIcon,
  Info,
  ShoppingBasket,
} from '@mui/icons-material';
import { IconButton, Menu, MenuItem } from '@mui/material';
import classNames from 'classnames';
import React, { useState } from 'react';
import { useSiteDispatch, useSiteState } from '../../contexts/SiteContext';

export default function HomeMenu(props: any) {
  const [homeMenu, setHomeMenu] = useState<null | HTMLElement>(null);
  var siteDispatch: any = useSiteDispatch();
  const { site }: any = useSiteState();

  const changeMenu = (menu: string) => {
    siteDispatch({ type: 'UPDATE_MENU', menu });
  };

  return (
    <React.Fragment>
      {site ? (
        <React.Fragment>
          <IconButton
            aria-haspopup="true"
            color="inherit"
            sx={{ ml: 2, p: 0.5 }}
            aria-controls="home-menu"
            onClick={(e) => setHomeMenu(e.currentTarget)}
            size="large">
            <HomeIcon sx={{ fontSize: 28 }} />
          </IconButton>
          <Menu
            id="home-menu"
            open={Boolean(homeMenu)}
            anchorEl={homeMenu}
            onClose={() => setHomeMenu(null)}
            sx={{ mt: 7 }}
            PaperProps={{ sx: { minWidth: 265 } }}
            disableAutoFocusItem
          >
            <div>
              {site.home && site.home.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('home');
                    setHomeMenu(null);
                  }}
                >
                  <HomeIcon sx={{ mr: 2, color: 'text.hint' }} /> Home
                </MenuItem>
              ) : null}
              {site.about && site.about.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('about');
                    setHomeMenu(null);
                  }}
                >
                  <Info sx={{ mr: 2, color: 'text.hint' }} /> About
                </MenuItem>
              ) : null}
              {site.catalog && site.catalog.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('catalog');
                    setHomeMenu(null);
                  }}
                >
                  <ShoppingBasket sx={{ mr: 2, color: 'text.hint' }} /> Catalog
                </MenuItem>
              ) : null}
              {site.reservation && site.reservation.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('reservation');
                    setHomeMenu(null);
                  }}
                >
                  <EventSeat sx={{ mr: 2, color: 'text.hint' }} /> Reservation
                </MenuItem>
              ) : null}
              {site.blog && site.blog.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('blog');
                    setHomeMenu(null);
                  }}
                >
                  <Book sx={{ mr: 2, color: 'text.hint' }} /> Blog
                </MenuItem>
              ) : null}
              {site.contact && site.contact.render ? (
                <MenuItem
                  sx={{
                    color: 'text.hint',
                    '&:hover, &:focus': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                  onClick={() => {
                    changeMenu('contact');
                    setHomeMenu(null);
                  }}
                >
                  <ContactMail sx={{ mr: 2, color: 'text.hint' }} /> Contact
                </MenuItem>
              ) : null}
            </div>
          </Menu>
        </React.Fragment>
      ) : null}
    </React.Fragment>
  );
}
