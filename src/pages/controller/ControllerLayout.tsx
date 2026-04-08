import { Outlet } from "react-router-dom";
import { useControllerConnection } from "../../contexts/ControllerContext";

export default function ControllerLayout() {
  useControllerConnection();
  return <Outlet />;
}
