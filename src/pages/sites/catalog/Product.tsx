import { Box, Button, Typography } from '@mui/material';
import React, { useState } from 'react';
import Counter from './Counter';

interface ProductProps {
  image: string;
  name: string;
  price: number | string;
  sku: string;
  maxOrderQty: number;
  onAddToCart: (product: any) => void;
}

export default function Product(props: ProductProps) {
  const [quantity, setQuantity] = useState(1);
  const { image, name, price, sku, maxOrderQty, onAddToCart } = props;

  const onQuantity = (quantity: number) => {
    setQuantity(quantity);
  };

  return (
    <Box
      sx={{
        background: '#fff',
        margin: '16px',
        width: '200px',
        borderRadius: '2px',
        transition: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
        },
      }}
    >
      <Box
        sx={{
          overflow: 'hidden',
          borderRadius: '2px 2px 0 0',
          maxHeight: '200px',
          '& img': {
            cursor: 'zoom-in',
            width: '100%',
            height: 'auto',
            transition: 'transform 300ms ease-in',
            transform: 'scale(1)',
            minHeight: { md: '200px' },
            '&:hover': {
              transform: 'scale(1.1)',
            },
          },
        }}
      >
        <img src={image} alt={name} />
      </Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 'normal',
          fontSize: '16px',
          lineHeight: '20px',
          mb: 1,
          color: '#666',
          px: 2,
          textAlign: 'center',
          height: '40px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </Typography>
      <Typography
        sx={{
          fontSize: '22px',
          fontWeight: '700',
          lineHeight: '22px',
          mb: 2,
          color: '#666',
          px: 2,
          textAlign: 'center',
          '&:before': {
            content: '"$ "',
          },
        }}
      >
        {price}
      </Typography>
      <Counter maxOrderQty={maxOrderQty} onQuantity={onQuantity} />
      <Box sx={{ p: 2 }}>
        <Button
          variant="contained"
          fullWidth
          sx={{
            transition: 'all 300ms ease-in',
            bgcolor: '#4caf50',
            '&:hover': { bgcolor: '#45a049' }
          }}
          onClick={() => onAddToCart({ image, name, price, sku, quantity })}
        >
          ADD TO CART
        </Button>
      </Box>
    </Box>
  );
}
