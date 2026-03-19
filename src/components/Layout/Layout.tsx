import { Outlet } from "react-router-dom";
import { useLayoutState } from "../../contexts/LayoutContext";
// components
import Header from "../Header";
import Sidebar from "../Sidebar";

// styles
import { LayoutRoot, MainContent, FakeToolbar } from "./LayoutStyles";

function Layout() {
  // global
  const { isSidebarOpened } = useLayoutState() as any;

  return (
    <LayoutRoot>
      <Header />
      <Sidebar />
      <MainContent open={isSidebarOpened}>
        <FakeToolbar />
        <Outlet />
      </MainContent>
    </LayoutRoot>
  );
}

export default Layout;
