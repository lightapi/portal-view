import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useLayoutState } from "../../contexts/LayoutContext";
import { allPageRegistry } from "../../tasks/pageRegistry";
import TaskContextPanel from "../../tasks/TaskContextPanel";
import TaskPageContextBar from "../../tasks/TaskPageContextBar";
import { contextFromSearchParams, pageDefinitionForRoute, saveRecentPageContext } from "../../tasks/taskUtils";
// components
import Sidebar from "../Sidebar";

// styles
import { LayoutRoot, MainContent } from "./LayoutStyles";

function Layout() {
  // global
  const { isSidebarOpened } = useLayoutState() as any;
  const location = useLocation();

  useEffect(() => {
    const page = pageDefinitionForRoute(allPageRegistry, location.pathname);
    if (!page) return;

    saveRecentPageContext(
      page,
      contextFromSearchParams(new URLSearchParams(location.search)),
    );
  }, [location.pathname, location.search]);

  return (
    <LayoutRoot>
      <Sidebar />
      <MainContent open={isSidebarOpened}>
        <TaskContextPanel />
        <TaskPageContextBar />
        <Outlet />
      </MainContent>
    </LayoutRoot>
  );
}

export default Layout;
