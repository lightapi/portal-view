import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import React from 'react';
import MerchantOrderTab from './MerchantOrderTab';

export default function MerchantOrders(props) {
  const [value, setValue] = React.useState(0);

  const handleChange = (event, newValue) => {
    console.log(newValue);
    setValue(newValue);
  };

  return (
    <>
      <Paper square>
        <Tabs
          value={value}
          indicatorColor="primary"
          textColor="primary"
          onChange={handleChange}
          aria-label="tabs order"
        >
          <Tab label="Confirmed" />
          <Tab label="Delivered" />
          <Tab label="Cancelled" />
        </Tabs>
      </Paper>
      {value === 0 ? <MerchantOrderTab {...props} status="Confirmed" /> : null}
      {value === 1 ? <MerchantOrderTab {...props} status="Delivered" /> : null}
      {value === 2 ? <MerchantOrderTab {...props} status="Cancelled" /> : null}
    </>
  );
}
