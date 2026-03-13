import React, { useState } from 'react';
import Popper from '@mui/material/Popper';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import HelpIcon from '@mui/icons-material/Help';
import IconButton from '@mui/material/IconButton';

interface ChaosInfoPopperProps {
  formType: string;
  handlerName: string;
}

export default function ChaosInfoPopper({ formType, handlerName }: ChaosInfoPopperProps) {
  const [popperAnchor, setPopperAnchor] = useState<null | HTMLElement>(null);
  const [popperOpen, setPopperOpen] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setPopperAnchor(event.currentTarget);
    setPopperOpen((previousOpenState) => !previousOpenState);
  };

  const canBeOpen = popperOpen && Boolean(popperAnchor);
  const id = canBeOpen ? 'transition-popper' : undefined;
  
  let description: React.ReactNode = 'Unknown form type!';

  if (formType === 'initAssault') {
    description = (
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Enter an endpoint for your api, and enter in the number of requests
          you want to try.
        </Typography>
        <Typography variant="body2">
          Pressing 'Start' will trigger the chaos monkey assault on your
          service.
        </Typography>
      </Box>
    );
  } else if (formType === 'configAssault') {
    description = (
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>Configure the {handlerName} config on your service.</Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          <Box component="li">
            'Enabled' is to enable/disable the Exception Assault handler on your
            service.
          </Box>
          <Box component="li">
            'Bypass' is to set whether or not the request will go through the{' '}
            {handlerName} ({handlerName} also has to be set to 'enabled').
          </Box>
          <Box component="li">
            'Level' is the frequency of your app being attacked on requests.
          </Box>
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>Pressing 'Go' will send the config request to your service</Typography>
      </Box>
    );
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        aria-describedby={id}
        sx={{ p: '5px' }}
        color="primary"
      >
        <HelpIcon />
      </IconButton>
      <Popper
        id={id}
        open={popperOpen}
        placement="right-start"
        anchorEl={popperAnchor}
        transition
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Box sx={{ border: 1, p: 2, bgcolor: 'background.paper', boxShadow: 1, borderRadius: 1 }}>
              {description}
            </Box>
          </Fade>
        )}
      </Popper>
    </>
  );
}

import { Typography } from '@mui/material';
