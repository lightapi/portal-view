import AssessmentIcon from "@mui/icons-material/Assessment";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import HelpIcon from "@mui/icons-material/Help";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PermDataSettingIcon from "@mui/icons-material/PermDataSetting";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import React, { useEffect, useState } from "react";
import { useAppState } from "../../contexts/AppContext";
import { useUserState } from "../../contexts/UserContext";

// import './Dashboard.css';

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function HostDashboard(props) {
  // first we need to get the userId so that we can get the host from the email domain.
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const { email, host } = useUserState();

  const cmd = {
    host: "lightapi.net",
    service: "host",
    action: "getHost",
    version: "0.1.0",
    data: { host },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

  const queryFn = async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      //console.log(response);
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
      } else {
        const data = await response.json();
        setData(data);
      }
      setLoading(false);
    } catch (e) {
      setError(e);
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    queryFn(url, headers);
  }, []);

  let wait;

  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    console.log("data = ", data);
    wait = (
      <div>
        <pre>{data ? JSON.stringify(data, null, 2) : error}</pre>
      </div>
    );
  }

  return <div>{wait}</div>;
}

export default HostDashboard;
