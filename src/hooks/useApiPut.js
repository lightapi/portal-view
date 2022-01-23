import { useReducer, useEffect } from 'react';
import { requestStarted, requestSuccess, requestFailure } from './action';
import { reducer } from './reducer';
import Cookies from 'universal-cookie'

export const useApiPut = ({ url, headers, body }) => {
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
        Object.assign(headers, {'X-CSRF-TOKEN': cookies.get('csrf')}, {'Content-Type': 'application/json'})
        const response = await fetch(url, { method: 'PUT', body: JSON.stringify(body), headers, credentials: 'include', signal: abortController.signal });
        console.log(response);
        if (!response.ok) {
          const status = await response.json();
          dispatch(requestFailure({ error: status }));
        } else {
          const data = await response.json();
          console.log(data);
          dispatch(requestSuccess({ data }));  
        }
      } catch (e) {
        // only call dispatch when we know the fetch was not aborted
        if (!abortController.signal.aborted) {
          console.log(e.message);
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
