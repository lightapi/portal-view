import React, { ReactNode, useReducer, useContext, createContext } from "react";

interface SiteState {
  site: any;
  owner: any;
  cart: any[];
  delivery: any;
  payment: any;
  specDetail: any;
  configDetail: any;
  filter: string | null;
  menu: string;
}

type SiteAction =
  | { type: "UPDATE_SITE"; site: any; owner: any }
  | { type: "UPDATE_INSTRUCTION"; instruction: any }
  | { type: "UPDATE_MENU"; menu: string }
  | { type: "UPDATE_FILTER"; filter: string }
  | { type: "UPDATE_CART"; cart: any[] }
  | { type: "UPDATE_DELIVERY"; delivery: any }
  | { type: "UPDATE_PAYMENT"; payment: any }
  | { type: "UPDATE_SPECDETAIL"; specDetail: any }
  | { type: "UPDATE_CONFIGDETAIL"; configDetail: any };

const SiteStateContext = createContext<SiteState | undefined>(undefined);
const SiteDispatchContext = createContext<React.Dispatch<SiteAction> | undefined>(undefined);

function siteReducer(state: SiteState, action: SiteAction): SiteState {
  // console.log("state = ", state);
  // console.log("action = ", action);
  switch (action.type) {
    case "UPDATE_SITE":
      return { ...state, site: action.site, owner: action.owner };
    case "UPDATE_INSTRUCTION":
      return { ...state, delivery: { instruction: action.instruction } }
    case "UPDATE_MENU":
      return { ...state, menu: action.menu };
    case "UPDATE_FILTER":
      return { ...state, filter: action.filter.toLowerCase() };
    case "UPDATE_CART":
      return { ...state, cart: action.cart };
    case "UPDATE_DELIVERY":
      return { ...state, delivery: action.delivery };
    case "UPDATE_PAYMENT":
      return { ...state, payment: action.payment };
    case "UPDATE_SPECDETAIL":
      return { ...state, specDetail: action.specDetail };
    case "UPDATE_CONFIGDETAIL":
      return { ...state, configDetail: action.configDetail };
    default: {
      throw new Error(`Unhandled action type: ${(action as any).type}`);
    }
  }
}

function SiteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(siteReducer, {
    site: null,
    owner: null,
    cart: [],
    delivery: {},
    payment: {},
    specDetail: {},
    configDetail: {},
    filter: null,
    menu: 'catalog'
  });

  return (
    <SiteStateContext.Provider value={state}>
      <SiteDispatchContext.Provider value={dispatch}>
        {children}
      </SiteDispatchContext.Provider>
    </SiteStateContext.Provider>
  );
}

function useSiteState(): SiteState {
  const context = useContext(SiteStateContext);
  if (context === undefined) {
    throw new Error("useSiteState must be used within a SiteProvider");
  }
  return context;
}

function useSiteDispatch(): React.Dispatch<SiteAction> {
  const context = useContext(SiteDispatchContext);
  if (context === undefined) {
    throw new Error("useSiteDispatch must be used within a SiteProvider");
  }
  return context;
}

function updateSite(dispatch: React.Dispatch<SiteAction>, site: any, owner: any) {
    dispatch({ type: "UPDATE_SITE", site, owner });
}

export { SiteProvider, useSiteState, useSiteDispatch, updateSite };


