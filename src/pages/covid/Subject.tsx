import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useUserState } from '../../contexts/UserContext';
import { timeConversion } from '../../utils';
import StatusItem from './StatusItem';

export default function Subject(props) {
  const items = props.items;
  const category = props.category;
  const isReadonly = props.isReadonly;
  const { isAuthenticated, userId } = useUserState();
  console.log('userId = ', userId);
  const [expanded, setExpanded] = useState(false);
  const [currentItem, setCurrentItem] = useState('');
  const first =
    items.length > 0
      ? timeConversion(Date.now() - Object.keys(items[0])[0]) +
        ' ' +
        items[0][Object.keys(items[0])[0]]
      : '';

  return (
    <Accordion onClick={() => setExpanded(true)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          {isReadonly ? null : (
            <DeleteIcon
              onClick={() => {
                props.delCategory(category);
              }}
            />
          )}{' '}
          {category} : {first}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {expanded && (
          <React.Fragment>
            <List>
              {items.map((item, index) => (
                <StatusItem
                  key={index}
                  isReadonly={isReadonly}
                  deleteItem={props.deleteItem}
                  category={category}
                  item={item}
                />
              ))}
            </List>
            {!isAuthenticated ? null : (
              <div>
                <input
                  type="text"
                  value={currentItem}
                  placeholder="Enter a new item"
                  onChange={(e) => {
                    setCurrentItem(e.target.value);
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    props.createItem(
                      category,
                      isReadonly
                        ? '[' + userId + ']:' + currentItem
                        : currentItem
                    );
                  }}
                >
                  Create Item
                </Button>
              </div>
            )}
          </React.Fragment>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
