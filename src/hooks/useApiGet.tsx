import { useReducer, useEffect } from 'react';
import { requestStarted, requestSuccess, requestFailure } from './action';
import { reducer } from './reducer';
import fetchClient from '../utils/fetchClient';

export const useApiGet = ({ url, headers = {}, callback }) => {
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
        const data = await fetchClient(url, { headers, signal: abortController.signal });
        console.log("data", data);
        if (callback) callback(data);
        dispatch(requestSuccess({ data }));
      } catch (e) {
        // only call dispatch when we know the fetch was not aborted
        if (!abortController.signal.aborted) {
          console.log(e);
          dispatch(requestFailure({ error: e }));
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
