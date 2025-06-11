import React, { useReducer, useContext } from "react";

var AppStateContext = React.createContext();
var AppDispatchContext = React.createContext();

function appReducer(state, action) {
  console.log("state = ", state);
  console.log("action = ", action);
  switch (action.type) {
    case "UPDATE_FILTER":
      return { ...state, filter: action.filter.toLowerCase() };
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}

function AppProvider({ children }) {
  // console.log("AppProvider is called...");
  var [state, dispatch] = useReducer(appReducer, {
    filter: null
  });

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

function useAppState() {
  var context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within a AppProvider");
  }
  return context;
}

function useAppDispatch() {
  var context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within a AppProvider");
  }
  return context;
}

export { AppProvider, useAppState, useAppDispatch };
