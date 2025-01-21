// this is a component to render an item in the BlogList component.
import React, { useState, useEffect } from "react";
import Cookies from "universal-cookie";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import useStyles from "./styles";

export default function RuleListItem(props) {
  const classes = useStyles();
  console.log(props);
  const { data, host, history } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleUpdate = (ruleId) => {
    const cmd = {
      host: "lightapi.net",
      service: "rule",
      action: "getRuleById",
      version: "0.1.0",
      data: { host, ruleId },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({ pathname: "/app/form/updateRule", state: { data } });
    };

    const queryRules = async (url, headers, callback) => {
      try {
        setLoading(true);
        const response = await fetch(url, { headers, credentials: "include" });
        if (!response.ok) {
          const error = await response.json();
          setError(error.description);
        } else {
          const data = await response.json();
          callback(data);
        }
        setLoading(false);
      } catch (e) {
        console.log(e);
        setError(e);
        setLoading(false);
      }
    };
    queryRules(url, headers, callback);
  };

  const handleDelete = (ruleId) => {
    if (window.confirm("Are you sure you want to delete the rule?")) {
      history.push({
        pathname: "/app/rule/deleteRule",
        state: { data: { ruleId, host } },
      });
    }
  };

  return (
    <TableRow className={classes.title}>
      <TableCell align="left">{data}</TableCell>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(data)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(data)} />
      </TableCell>
    </TableRow>
  );
}
