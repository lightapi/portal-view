import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import Modal from '@mui/material/Modal';
import React from 'react';
import { Typography } from '../../Wrappers/Wrappers';
import useStyles from './styles';

export default function ConfigEditModal(props) {
  var classes = useStyles();
  const style = {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 800,
    height: 650,
    bgcolor: 'background.paper',
    border: '2px solid #eee',
    boxShadow: 24,
    p: 4,
  };

  // const [open, setOpen] = React.useState(false);
  // const handleOpen = () => setOpen(true);
  const handleClose = () => props.onClose(false);

  return (
    <>
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={props.open}
        onClose={handleClose}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={props.open}>
          <Box sx={style}>
            <Typography id="transition-modal-title" variant="h6" component="h2">
              Edit Config
            </Typography>
            <Typography id="transition-modal-description" sx={{ mt: 2 }}>
              Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
            </Typography>

            <Box
              className={classes.modalActionContainer}
              style={{ display: 'flex' }}
            >
              <span>Error Message</span>
              <Button
                variant="contained"
                size="medium"
                // className={classes.actionButton}
                onClick={handleClose}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </>
  );
}
