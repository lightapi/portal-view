import { IconButton, Box, TextField } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import React, { useEffect, useState } from 'react';

interface CounterProps {
  onQuantity: (quantity: number) => void;
  maxOrderQty: number;
}

export default function Counter({ onQuantity, maxOrderQty }: CounterProps) {
  const [value, setValue] = useState(1);

  useEffect(() => {
    onQuantity(value);
  }, [value, onQuantity]);

  const increment = () => {
    if (value < maxOrderQty) {
      setValue(prev => prev + 1);
    }
  };

  const decrement = () => {
    if (value > 1) {
      setValue(prev => prev - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > maxOrderQty) val = maxOrderQty;
    setValue(val);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: '#666',
        maxWidth: '150px',
        margin: '0 auto',
      }}
    >
      <IconButton 
        onClick={decrement}
        size="small"
        sx={{
          border: '1px solid #ccc',
          '&:hover': {
            borderColor: '#077915',
            color: '#077915',
          }
        }}
      >
        <Remove fontSize="small" />
      </IconButton>
      <TextField
        size="small"
        value={value}
        onChange={handleInputChange}
        inputProps={{
          style: { textAlign: 'center', padding: '4px 0' },
          type: 'number'
        }}
        sx={{
          width: '50px',
          '& .MuiOutlinedInput-root': {
            height: '30px',
          }
        }}
      />
      <IconButton 
        onClick={increment}
        size="small"
        sx={{
          border: '1px solid #ccc',
          '&:hover': {
            borderColor: '#077915',
            color: '#077915',
          }
        }}
      >
        <Add fontSize="small" />
      </IconButton>
    </Box>
  );
}
