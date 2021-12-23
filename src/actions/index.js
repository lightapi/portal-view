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
    const request = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action),
    };
    //console.log(request);
    try {
      const response = await fetch('/api/portal', request);
      const data = await response.json();
      //console.log("data", data);
      dispatch({ type: SUBMIT_FORM_SUCCESS, payload: data });
    } catch (e) {
      //console.log("error " + e.toString());
      dispatch({ type: SUBMIT_FORM_FAILURE, error: e.toString() });
    }
  };
}
