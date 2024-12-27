import React from "react";
import Cookies from 'universal-cookie'

var UserStateContext = React.createContext();
var UserDispatchContext = React.createContext();

function userReducer(state, action) {
  console.log("state = ", state);
  console.log("action = ", action);
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return { ...state, isAuthenticated: action.isAuthenticated, email: action.email, userId: action.userId, eid: action.eid, roles: action.roles, host: action.host };
    case "SIGN_OUT_SUCCESS":
      return { ...state, isAuthenticated: false, email: null, userId: null, eid: null, roles: null, host: null };
    case "UPDATE_PROFILE":
      return { ...state, userId: action.userId, host: action.host }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}

function UserProvider({ children }) {
  const cookies = new Cookies();
  const userId = cookies.get('userId');
  const refreshToken = cookies.get('refreshToken');
  const host = cookies.get('host');
  const email = cookies.get('email');
  const eid = cookies.get('eid');
  const roles = cookies.get('roles');
  console.log("userId = ", userId, "refreshToken = ", refreshToken, "host = ", host, "email = ", email, "eid = ", eid, "roles = ", roles);
  var [state, dispatch] = React.useReducer(userReducer, {
    isAuthenticated: !!userId,
    userId: userId,
    eid: eid,
    host: host,
    email: email,
    roles: roles
  });

  if(email == null && refreshToken != null) {
    // send a fake request to server to renew the access token from refreshToken 
    // in case you have set the remember me to true during login. 
    console.log("email is null and fetch is not done yet, renew the token...");
    const cmd = {
      host: 'lightapi.net',
      service: 'user',
      action: 'getNonceByUserId',
      version: '0.1.0',
      data: { userId: 'fake' }
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const headers = {};
    const fetchData = async () => {
      try {
        const response = await fetch(url, { headers, credentials: 'include' });
        const data = await response.json();
        //console.log("data = ", data);
        //console.log("userId = " + cookies.get('userId'));
        if(data.statusCode === 404) {
          // if other errors, then there would be no cookies. Only 404 is the right response in this case.
          // if we don't check the status code and blindly dispatch, we will go into a dead loop as there is userId available.
          dispatch({ type: "LOGIN_SUCCESS", isAuthenticated: !!cookies.get('userId'), email: cookies.get('userId'), roles: cookies.get('roles') });
        }
      } catch (e) {
        console.log(e);
      }
    };
    fetchData();
  } 

  return (
    <UserStateContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  );
}

function useUserState() {
  var context = React.useContext(UserStateContext);
  if (context === undefined) {
    throw new Error("useUserState must be used within a UserProvider");
  }
  return context;
}

function useUserDispatch() {
  var context = React.useContext(UserDispatchContext);
  if (context === undefined) {
    throw new Error("useUserDispatch must be used within a UserProvider");
  }
  return context;
}

export { UserProvider, useUserState, useUserDispatch, loginUser, signOut, signUp, changePassword, getProfile, getPayment, updateRoles, getOrders, hostForm };

// ###########################################################

function loginUser(dispatch, login, password, navigate, setIsLoading, setError) {
  setError(false);
  setIsLoading(true);
  console.log("login = ", login, "password = ", password);
  if (!!login && !!password) {
    setTimeout(() => {
      localStorage.setItem('id_token', 1)
      setError(null)
      setIsLoading(false)
      dispatch({ type: 'LOGIN_SUCCESS' })
      navigate('/app/dashboard')
    }, 2000);
  } else {
    dispatch({ type: "LOGIN_FAILURE" });
    setError(true);
    setIsLoading(false);
  }
}

function signOut(dispatch, navigate) {
    dispatch({ type: "SIGN_OUT_SUCCESS" });
    fetch("/logout", { credentials: 'include'})
    .then(response => {
      if(response.ok) {
        navigate("/app/dashboard");
      } else {
        throw Error(response.statusText);
      }
    })
    .catch(error => {
        console.log("error=", error);
    });
}

function changePassword(dispatch, navigate) {
  navigate("/app/form/changePasswordForm");
}

function signUp(dispatch, navigate) {
  navigate("/app/form/signupForm");
}

function getProfile(dispatch, navigate) {
  navigate("/app/profile");
}

function getPayment(dispatch, navigate) {
  navigate("/app/payment");
}

function updateRoles(dispatch, navigate) {
  navigate("/app/updateRoles");
}

function getOrders(dispatch, navigate) {
  navigate("/app/userOrders");
}

function hostForm(dispatch, navigate) {
  navigate("/app/form/hostForm");
}
