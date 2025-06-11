import React, { useState } from 'react';
import Popper from '@mui/material/Popper';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import HelpIcon from '@mui/icons-material/Help';
import IconButton from '@mui/material/IconButton';

export default function ChaosInfoPopper(props) {
  const formType = props.formType;
  const [popperAnchor, setPopperAnchor] = useState(null);
  const [popperOpen, setPopperOpen] = useState(false);
  const handlerName = props.handlerName;

  const handleClick = (event) => {
    setPopperAnchor(event.currentTarget);
    setPopperOpen((previousOpenState) => !previousOpenState);
  };

  const canBeOpen = popperOpen && Boolean(popperAnchor);
  const id = canBeOpen ? 'transition-popper' : undefined;
  let description = 'Unknown form type!';

  if (formType === 'initAssault') {
    description = (
      <div>
        <p>
          Enter an endpoint for your api, and enter in the number of requests
          you want to try.
        </p>
        <p>
          Pressing 'Start' will trigger the chaos monkey assault on your
          service.
        </p>
      </div>
    );
  } else if (formType === 'configAssault') {
    description = (
      <div>
        <p>Configure the {handlerName} config on your service.</p>
        <ul>
          <li>
            'Enabled' is to enable/disable the Exception Assault handler on your
            service.
          </li>
          <li>
            'Bypass' is to set whether or not the request will go through the{' '}
            {handlerName} ({handlerName} also has to be set to 'enabled').
          </li>
          <li>
            'Level' is the frequency of your app being attacked on requests.
          </li>
        </ul>
        <p>Pressing 'Go' will send the config request to your service</p>
      </div>
    );
  }

  return (
    <React.Fragment>
      <IconButton
        onClick={handleClick}
        aria-describedby={id}
        style={{ padding: 5 }}
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
            <Box sx={{ border: 1, p: 1, bgcolor: 'background.paper' }}>
              {description}
            </Box>
          </Fade>
        )}
      </Popper>
    </React.Fragment>
  );
}
