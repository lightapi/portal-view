import { makeStyles } from "@mui/styles";
import { Outlet } from "react-router-dom";
import classNames from "classnames";
import { useLayoutState } from "../../contexts/LayoutContext";
// components
import Header from "../Header";
import Sidebar from "../Sidebar";

// styles
const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    maxWidth: "100vw",
    overflowX: "hidden",
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(3),
    width: `calc(100vw - 240px)`,
    minHeight: "100vh",
  },
  contentShift: {
    width: `calc(100vw - ${240 + theme.spacing(6)}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  fakeToolbar: {
    ...theme.mixins.toolbar,
  },
}));

function Layout() {
  const classes = useStyles();

  // global
  const layoutState = useLayoutState();

  return (
    <div className={classes.root}>
      <Header />
      <Sidebar />
      <div
        className={classNames(classes.content, {
          [classes.contentShift]: layoutState.isSidebarOpened,
        })}
      >
        <div className={classes.fakeToolbar} />
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;
