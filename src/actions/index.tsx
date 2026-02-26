import fetchClient from '../utils/fetchClient';
import {
  LOAD_MENU,
  SUBMIT_FORM_FAILURE,
  SUBMIT_FORM_STARTED,
  SUBMIT_FORM_SUCCESS,
} from './types';

export function loadMenu(host) {
  return {
    type: LOAD_MENU,
    payload: host,
  };
}

export function submitForm(action) {
  return async (dispatch) => {
    dispatch({ type: SUBMIT_FORM_STARTED });
    try {
      const data = await fetchClient('/api/portal', {
        method: 'POST',
        body: action,
      });
      dispatch({ type: SUBMIT_FORM_SUCCESS, payload: data });
    } catch (e) {
      dispatch({ type: SUBMIT_FORM_FAILURE, error: e.toString() });
    }
  };
}
