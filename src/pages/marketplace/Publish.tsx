import React from 'react';
import { useUserState } from '../../contexts/UserContext';
import FormDispatcher from './FormDispatcher';

// This is the publish entry point for users to update his/her website after logging in.

export default function Publish(props) {
  const { email } = useUserState();
  const params = new URLSearchParams(props.location.search);
  const category = params.get('category');
  const subcategory = params.get('subcategory');

  let wait;
  if (category && subcategory) {
    wait = (
      <FormDispatcher
        {...props}
        category={category}
        subcategory={subcategory}
      />
    );
  }

  return <div className="App">{wait}</div>;
}
