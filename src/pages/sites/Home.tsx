import Fab from '@mui/material/Fab';
import { Box } from '@mui/material';
import React from 'react';
import { useSiteDispatch } from '../../contexts/SiteContext';

interface HomeProps {
  background: string;
  name: string;
  title: string;
  buttons: { menu: string; label: string }[];
  nameSize?: string;
  titleSize?: string;
}

export default function Home(props: HomeProps) {
  const siteDispatch = useSiteDispatch();

  const onButtonClick = (menu: string) => {
    siteDispatch({ type: 'UPDATE_MENU', menu });
  };

  const nameSize = props.nameSize || '110px';
  const titleSize = props.titleSize || '70px';

  return (
    <Box
      sx={{
        height: '100vh',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
        backgroundImage: `url(${props.background})`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          padding: '40px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            textAlign: 'center',
            fontSize: nameSize,
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: 'white',
            textShadow: '3px 3px 6px #000000',
          }}
        >
          {props.name}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            textAlign: 'center',
            fontSize: titleSize,
            fontWeight: 'bold',
            color: 'white',
            font: 'normal normal normal 56px/1.4em lulo-clean-w01-one-bold,sans-serif',
            letterSpacing: '6px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {props.title}
        </Box>
        <Box sx={{ mt: 'auto', mb: 10, display: 'flex', gap: 2 }}>
          {props.buttons.map((button) => (
            <Fab
              variant="extended"
              key={button.menu}
              color="primary"
              onClick={() => onButtonClick(button.menu)}
            >
              {button.label}
            </Fab>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
