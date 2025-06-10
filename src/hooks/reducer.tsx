import { createContext } from 'react';
import { 
  GET_REQUEST_STARTED, 
  GET_REQUEST_SUCCESS, 
  GET_REQUEST_FAILURE 
} from './action';

export const AppContext = createContext(null);

export const initialState = {
  isLoggedIn: false,
  userId: null
}

export const reducer = (state, action) => {
  // we check the type of each action and return an updated state object accordingly
  switch (action.type) {
    case GET_REQUEST_STARTED:
      return {
        ...state,
        isLoading: true,
      };
    case GET_REQUEST_SUCCESS:
      return {
        ...state,
        isLoading: false,
        error: null,
        data: action.data,
      };
    case GET_REQUEST_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.error,
      };
    // usually I ignore the action if its `type` is not matched here, some people prefer throwing errors here - it's really up to you.
    default:
      return state;
  }
};
