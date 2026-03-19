import VideoCallIcon from '@mui/icons-material/VideoCall';
import { Grid, Box, IconButton } from '@mui/material';
import React, { useState } from 'react';
import VideoPopup from './VideoPopup';

interface VideoListProps {
  vs: { u: string }[];
}

export default function VideoList({ vs }: VideoListProps) {
  const [openPosition, setOpenPosition] = useState(-1);

  return (
    <Box>
      <Grid container alignItems="center" sx={{ color: 'text.secondary', gap: 1 }}>
        {vs.map((video, index) => (
          <Box key={index}>
            <IconButton onClick={() => setOpenPosition(index)} size="small" color="inherit">
              <VideoCallIcon />
            </IconButton>
            <VideoPopup
              open={index === openPosition}
              reset={() => setOpenPosition(-1)}
              url={video.u}
            />
          </Box>
        ))}
      </Grid>
    </Box>
  );
}
