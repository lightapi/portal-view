import VideoCallIcon from '@mui/icons-material/VideoCall';
import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import React, { useState } from 'react';
import VideoPopup from './VideoPopup';

const useStyles = makeStyles((theme) => ({
  root: {
    color: theme.palette.text.secondary,
  },
}));

export default function VideoList(props) {
  const classes = useStyles();
  const [openPosition, setOpenPosition] = useState(-1);
  const { vs } = props;
  console.log('vs = ', vs);
  console.log('openPosition = ', openPosition);
  return (
    <div>
      <Grid container alignItems="center" className={classes.root}>
        {vs.map((video, index) => (
          <div key={index}>
            <VideoCallIcon onClick={() => setOpenPosition(index)} />
            <VideoPopup
              open={index === openPosition}
              reset={() => setOpenPosition(-1)}
              url={video.u}
            />
          </div>
        ))}
      </Grid>
    </div>
  );
}
