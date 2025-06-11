import React, { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Image } from '@mui/icons-material';

export default function ImagePopup(props) {
  const [open, setOpen] = useState(false);
  const { images } = props;

  const slides = images.map(image => ({ src: image.u }));

  return (
    <div>
      <Image onClick={() => setOpen(true)} />
      {open && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={slides}
        />
      )}
    </div>
  );
}