import SearchIcon from '@mui/icons-material/Search';
import { makeStyles } from '@mui/styles';
import React from 'react';

const useStyles = makeStyles({
  noResult: {
    textAlign: 'center',
  },
});

const NoResult = () => {
  var classes = useStyles();
  return (
    <div>
      <div className={classes.noResult}>
        <SearchIcon />
        <h2>Sorry, no products matched your search!</h2>
        <p>Enter a different keyword and try.</p>
      </div>
    </div>
  );
};

export default NoResult;
