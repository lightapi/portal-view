export const GET_REQUEST_STARTED = 'GET_REQUEST_STARTED';
export const GET_REQUEST_SUCCESS = 'GET_REQUEST_SUCCESS';
export const GET_REQUEST_FAILURE = 'GET_REQUEST_FAILURE';

export const requestSuccess = ({data}) => ({
    type: GET_REQUEST_SUCCESS,
    data,
});

export const requestStarted = () => ({
	type: GET_REQUEST_STARTED
});

export const requestFailure = ({error}) => ({
    type: GET_REQUEST_FAILURE,
    error,
});
