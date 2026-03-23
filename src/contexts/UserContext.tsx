import React from "react";
import Cookies from "universal-cookie";
import fetchClient from "../utils/fetchClient";

interface UserState {
  isAuthenticated: boolean;
  email: string | null;
  userId: string | null;
  eid: string | null;
  roles: string | null;
  host: string | null;
}

type UserAction =
  | { type: "LOGIN_SUCCESS"; isAuthenticated?: boolean; email?: string | null; userId?: string | null; eid?: string | null; roles?: string | null; host?: string | null }
  | { type: "SIGN_OUT_SUCCESS" }
  | { type: "UPDATE_PROFILE"; userId: string; host: string }
  | { type: "LOGIN_FAILURE" };

var UserStateContext = React.createContext<UserState | undefined>(undefined);
var UserDispatchContext = React.createContext<React.Dispatch<UserAction> | undefined>(undefined);

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return {
        ...state,
        isAuthenticated: action.isAuthenticated ?? state.isAuthenticated,
        email: action.email ?? state.email,
        userId: action.userId ?? state.userId,
        eid: action.eid ?? state.eid,
        roles: action.roles ?? state.roles,
        host: action.host ?? state.host,
      };
    case "SIGN_OUT_SUCCESS":
      return {
        ...state,
        isAuthenticated: false,
        email: null,
        userId: null,
        eid: null,
        roles: null,
        host: null,
      };
    case "UPDATE_PROFILE":
      return { ...state, userId: action.userId, host: action.host };
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}

function UserProvider({ children }: { children: React.ReactNode }) {
  const cookies = new Cookies();
  const userId = cookies.get("userId");
  const refreshToken = cookies.get("refreshToken");
  const host = cookies.get("host");
  const email = cookies.get("email");
  const eid = cookies.get("eid");
  const roles = cookies.get("roles") ? atob(cookies.get("roles")) : null;
  var [state, dispatch] = React.useReducer(userReducer, {
    isAuthenticated: !!userId,
    userId: userId,
    eid: eid,
    host: host,
    email: email,
    roles: roles,
  });

  if (email == null && refreshToken != null) {
    // send a fake request to server to renew the access token from refreshToken
    // in case you have set the remember me to true during login.
    console.log("email is null and fetch is not done yet, renew the token...");
    const cmd = {
      host: "lightapi.net",
      service: "user",
      action: "getNonceByUserId",
      version: "0.1.0",
      data: { userId: "fake" },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const fetchData = async () => {
      try {
        const data = await fetchClient(url);
        //console.log("data = ", data);
        //console.log("userId = " + cookies.get('userId'));
        if (data.statusCode === 404) {
          // if other errors, then there would be no cookies. Only 404 is the right response in this case.
          // if we don't check the status code and blindly dispatch, we will go into a dead loop as there is userId available.
          dispatch({
            type: "LOGIN_SUCCESS",
            isAuthenticated: !!cookies.get("userId"),
            email: cookies.get("userId"),
            roles: cookies.get("roles") ? atob(cookies.get("roles")) : null,
          });
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

export {
  UserProvider,
  useUserState,
  useUserDispatch,
  loginUser,
  signOut,
  signUp,
  changePassword,
  getProfile,
  getPayment,
  updateRoles,
  getOrders,
  createOrg,
  userHost,
};

function loginUser(
  dispatch: React.Dispatch<UserAction>,
  login: string | null,
  password: string | null,
  navigate: (path: string, options?: any) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: boolean | null) => void,
) {
  setError(false);
  setIsLoading(true);
  console.log("login = ", login, "password = ", password);
  if (!!login && !!password) {
    setTimeout(() => {
      localStorage.setItem("id_token", "1");
      setError(null);
      setIsLoading(false);
      dispatch({ type: "LOGIN_SUCCESS" });
      navigate("/app/dashboard");
    }, 2000);
  } else {
    dispatch({ type: "LOGIN_FAILURE" });
    setError(true);
    setIsLoading(false);
  }
}

function signOut(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  dispatch({ type: "SIGN_OUT_SUCCESS" });
  fetchClient("/logout")
    .then((data) => {
      navigate("/app/dashboard");
    })
    .catch((error) => {
      console.log("error=", error);
    });
}

function changePassword(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/form/changePasswordForm");
}

function signUp(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/form/signupForm");
}

function getProfile(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void, userId: string) {
  navigate(`/app/profile/${userId}`);
}

function getPayment(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/payment");
}

function updateRoles(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/updateRoles");
}

function getOrders(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/userOrders");
}

function createOrg(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  navigate("/app/form/createOrg");
}

function updateOrgForm(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  // load the org associated with the user. The user is allowed to update as it is org-admin role.
  navigate("/app/form/updateOrgForm");
}

function deleteOrgForm(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void) {
  // load the org associated with the user. The user is allowed to delete as it is org-admin role.
  navigate("/app/form/deleteOrgForm");
}

function userHost(dispatch: React.Dispatch<UserAction>, navigate: (path: string, options?: any) => void, userId: string) {
  navigate("/app/userHost", { state: { data: { userId } } });
}
