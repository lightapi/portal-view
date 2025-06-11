import DeleteIcon from '@mui/icons-material/Delete';
import ListItem from '@mui/material/ListItem';
import React from 'react';
import { useUserState } from '../../contexts/UserContext';
import { timeConversion } from '../../utils';

const StatusItem = React.memo(({ isReadonly, deleteItem, category, item }) => {
  const status =
    timeConversion(Date.now() - Object.keys(item)[0]) +
    ' ' +
    item[Object.keys(item)[0]];
  const { isAuthenticated, userId } = useUserState();

  const isDelIcon =
    !isReadonly ||
    (isReadonly && isAuthenticated && status.includes('[' + userId + ']:'));
  console.log('isDelIcon = ', isDelIcon);
  return (
    <ListItem>
      {!isDelIcon ? null : (
        <DeleteIcon onClick={() => deleteItem(category, item)} />
      )}{' '}
      {status}
    </ListItem>
  );
});

export default StatusItem;
