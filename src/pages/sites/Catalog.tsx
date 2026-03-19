import { Box } from '@mui/material';
import React from 'react';
import { useSiteDispatch, useSiteState } from '../../contexts/SiteContext';
import { useUserState } from '../../contexts/UserContext';
import CatalogHeader from './catalog/CatalogHeader';
import Footer from './catalog/Footer';
import Products from './catalog/Products';

interface CatalogProps {
  products: any[];
  storeName: string;
  storeTitle: string;
  [key: string]: any;
}

export default function Catalog(props: CatalogProps) {
  const { products, storeName, storeTitle } = props;

  const { cart } = useSiteState();
  const siteDispatch = useSiteDispatch();
  const { isAuthenticated } = useUserState();

  const checkProduct = (sku: string) => {
    return Array.isArray(cart) && cart.some((item) => item.sku === sku);
  };

  const onAddToCart = (selectedProduct: any) => {
    if (!isAuthenticated) {
      window.alert(
        'An anonymous user cannot checkout and receive notifications. Please log in first.'
      );
    } else {
      let sku = selectedProduct.sku;
      let qty = selectedProduct.quantity;
      if (checkProduct(sku)) {
        let index = cart.findIndex((x) => x.sku === sku);
        const newCart = [...cart];
        newCart[index] = {
          ...newCart[index],
          quantity: Number(newCart[index].quantity) + Number(qty)
        };
        siteDispatch({ type: 'UPDATE_CART', cart: newCart });
      } else {
        siteDispatch({ type: 'UPDATE_CART', cart: [...cart, selectedProduct] });
      }
    }
  };

  return (
    <Box
      sx={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: { xs: '0', md: '0 32px' },
      }}
    >
      <CatalogHeader storeName={storeName} storeTitle={storeTitle} />
      <Products onAddToCart={onAddToCart} products={products} />
      <Footer storeName={storeName} />
    </Box>
  );
}
