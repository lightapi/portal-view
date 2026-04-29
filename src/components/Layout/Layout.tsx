import { Outlet } from "react-router-dom";
import { useLayoutState } from "../../contexts/LayoutContext";
// components
import Sidebar from "../Sidebar";

// styles
import { LayoutRoot, MainContent } from "./LayoutStyles";

function Layout() {
  // global
  const { isSidebarOpened } = useLayoutState() as any;

  return (
    <LayoutRoot>
      <Sidebar />
      <MainContent open={isSidebarOpened}>
        <Outlet />
      </MainContent>
    </LayoutRoot>
  );
}

export default Layout;
