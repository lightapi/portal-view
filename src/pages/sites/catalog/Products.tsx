import { Grid, Box } from '@mui/material';
import React from 'react';
import { useSiteState } from '../../../contexts/SiteContext';
import NoResult from './NoResult';
import Product from './Product';

interface ProductsProps {
  products: any[];
  onAddToCart: (product: any) => void;
}

export default function Products({ products, onAddToCart }: ProductsProps) {
  const { filter } = useSiteState();
  const filteredProducts = products.filter(
    (product) => product.name.toLowerCase().includes(filter || '') || !filter
  );

  if (filteredProducts.length <= 0) {
    return <NoResult />;
  }

  return (
    <Box
      sx={{
        paddingTop: '8px',
        animation: 'slideUp 300ms linear',
        animationDelay: '150ms',
        '@keyframes slideUp': {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      <Grid container spacing={2} justifyContent="center">
        {filteredProducts.map((product) => (
          <Grid key={product.sku}>
            <Product
              price={product.price}
              name={product.name}
              image={product.image}
              sku={product.sku}
              maxOrderQty={product.maxOrderQty}
              onAddToCart={onAddToCart}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
