import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import React from 'react';
import { useSiteState } from '../../../contexts/SiteContext';
import NoResult from './NoResult';
import Product from './Product';

const useStyles = makeStyles({
  productsWrapper: {
    paddingTop: '8px',
    animation: 'slideUp 300ms linear',
    animationDelay: '150ms',
  },
});

export default function Products(props) {
  var classes = useStyles();
  const { products, onAddToCart } = props;
  const { filter } = useSiteState();
  const filteredProducts = products.filter(
    (product) => product.name.toLowerCase().includes(filter) || !filter
  );

  let productList = [];
  for (let i = 0; i < filteredProducts.length; i++) {
    productList.push(
      <Grid key={filteredProducts[i].sku} item>
        <Product
          key={filteredProducts[i].sku}
          price={filteredProducts[i].price}
          name={filteredProducts[i].name}
          image={filteredProducts[i].image}
          sku={filteredProducts[i].sku}
          maxOrderQty={filteredProducts[i].maxOrderQty}
          onAddToCart={onAddToCart}
        />
      </Grid>
    );
  }

  let view;
  if (filteredProducts.length <= 0) {
    view = <NoResult />;
  } else {
    view = productList;
  }
  return (
    <Grid container className={classes.productsWrapper}>
      {view}
    </Grid>
  );
}
