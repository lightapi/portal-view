import { useReducer, useEffect } from 'react';
import { requestStarted, requestSuccess, requestFailure } from './action';
import { reducer } from './reducer';
import Cookies from 'universal-cookie'

export const useApiDelete = ({ url, headers, callback }) => {
  const [state, dispatch] = useReducer(reducer, {
    isLoading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      dispatch(requestStarted());

      try {
        const cookies = new Cookies();
        Object.assign(headers, {'X-CSRF-TOKEN': cookies.get('csrf')})
        const response = await fetch(url, { method: 'DELETE', headers, credentials: 'include', signal: abortController.signal });
        if (response.status === 200) {
          // data is available
          const data = await response.json();
          console.log(data);
          if(callback) callback(data);
          dispatch(requestSuccess({ data }));  
        } else if (response.status === 204) {
          // no content. do nothing.
          dispatch(requestSuccess({}));  
        } else {
          // consider error here.
          const error = await response.json();
          dispatch(requestFailure({ error }));
        }
      } catch (e) {
        // only call dispatch when we know the fetch was not aborted
        if (!abortController.signal.aborted) {
          console.log(e);
          dispatch(requestFailure({ error: e.message }));
        }        
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

  return state;
};
