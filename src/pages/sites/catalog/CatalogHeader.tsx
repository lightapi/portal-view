import { makeStyles } from '@mui/styles';
import React from 'react';

const useStyles = makeStyles({
  header: {
    width: '100%',
    height: '100px',
    paddingLeft: '10px',
    left: 0,
    border: '1px solid #ccc',
    backgroundColor: '#fa4303',
    color: 'white',
    lineHeight: '20px',
  },
});

const CatalogHeader = (props) => {
  var classes = useStyles();
  return (
    <header className={classes.header}>
      <h1>{props.storeName}</h1>
      <h3>{props.storeTitle}</h3>
    </header>
  );
};

export default CatalogHeader;
