import Button from '@mui/material/Button';
import React, { useState } from 'react';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import Subject from './Subject';

export default function StatusContainer(props) {
  const [subjects, setSubjects] = useState(props.subjects);
  const [currentCategory, setCurrentCategory] = useState('');
  const { isAuthenticated } = useUserState();

  const createItem = (category, item) => {
    console.log('createItem is called!', category, item);
    let list = subjects[category];
    var object = {};
    object[Date.now().toString()] = item;
    list.unshift(object);
    //console.log("list = ", list);
    object = {};
    object[category] = list;
    setSubjects((prevState) => {
      return { ...prevState, ...object };
    });
  };

  const deleteItem = (category, item) => {
    console.log('deleteItem is called!', category, item);
    let list = subjects[category];
    console.log('list before removal', list);
    // remove the item from the list
    const filtered = list.filter((l) => l !== item);
    console.log('list after removal', filtered);
    let object = {};
    object[category] = filtered;
    setSubjects((prevState) => {
      return { ...prevState, ...object };
    });
  };

  const delCategory = (category) => {
    console.log('del category is called!', category);
    delete subjects[category];
    setSubjects((prevState) => {
      return { ...prevState };
    });
  };

  const addCategory = () => {
    console.log('add category is clicked!');
    let object = {};
    object[currentCategory] = [];
    setSubjects((prevState) => {
      return { ...prevState, ...object };
    });
  };

  const submitStatus = () => {
    console.log('submit status is clicked!');
    const url = '/portal/command';
    const action = {
      host: 'lightapi.net',
      service: 'covid',
      action: 'updateStatus',
      version: '0.1.0',
      data: subjects,
    };
    submit(url, action);
  };

  const updatePeerStatus = () => {
    console.log("update other user's status!");
    const url = '/portal/command';
    const headers = {
      'Content-Type': 'application/json',
    };
    const action = {
      host: 'lightapi.net',
      service: 'covid',
      action: 'updatePeerStatus',
      version: '0.1.0',
      data: {
        subjects,
        userId: props.userId,
      },
    };
    submit(url, action);
  };

  const submit = async (url, action) => {
    try {
      const data = await fetchClient(url, {
        method: 'POST',
        body: JSON.stringify(action),
      });
      console.log('submit response', data);
      props.history.push({ pathname: '/app/success', state: { data } });
    } catch (e) {
      // network error here.
      console.log(e);
      // convert it to json as the failure component can only deal with JSON.
      const error = { error: e.description || e.message || e };
      props.history.push({ pathname: '/app/failure', state: { error } });
    }
  };

  return (
    <React.Fragment>
      {Object.keys(subjects).map((key) => (
        <Subject
          key={key}
          isReadonly={props.isReadonly}
          category={key}
          delCategory={delCategory}
          createItem={createItem}
          deleteItem={deleteItem}
          items={subjects[key]}
        />
      ))}
      {!isAuthenticated ? null : (
        <div>
          {props.isReadonly ? (
            <Button
              variant="contained"
              color="primary"
              onClick={updatePeerStatus}
            >
              Update Peer Status
            </Button>
          ) : (
            <div>
              <input
                type="text"
                value={currentCategory}
                placeholder="Enter a new category"
                onChange={(e) => {
                  setCurrentCategory(e.target.value);
                }}
              />
              <Button variant="contained" color="primary" onClick={addCategory}>
                Add Category
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={submitStatus}
              >
                Submit Status
              </Button>
            </div>
          )}
        </div>
      )}
    </React.Fragment>
  );
}
