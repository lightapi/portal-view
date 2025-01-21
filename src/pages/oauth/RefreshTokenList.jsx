import AddToQueueIcon from "@mui/icons-material/AddToQueue";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { makeStyles } from "@mui/styles";
import React, { useState } from "react";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import { timeConversion } from "../../utils";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row, history, email, roles, host } = props;
  const fields = row.split("|");
  const refreshToken = fields[0];
  const userId = fields[1];
  const timestamp = timeConversion(new Date().getTime() - Number(fields[2]));
  const classes = useRowStyles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleDetail = (refreshToken) => {
    const cmd = {
      host: "lightapi.net",
      service: "oauth",
      action: "getRefreshTokenDetail",
      version: "0.1.0",
      data: { refreshToken },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({ pathname: "/app/refreshTokenDetail", state: { data } });
    };

    const queryRefreshToken = async (url, headers, callback) => {
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
    queryRefreshToken(url, headers, callback);
  };

  const handleDelete = (refreshToken) => {
    if (window.confirm("Are you sure you want to delete the refreshToken?")) {
      history.push({
        pathname: "/app/oauth/deleteRefreshToken",
        state: { data: { refreshToken } },
      });
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{refreshToken}</TableCell>
      <TableCell align="left">{userId}</TableCell>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="left">{timestamp}</TableCell>
      <TableCell align="right">
        <AddToQueueIcon onClick={() => handleDetail(refreshToken)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(refreshToken)} />
      </TableCell>
    </TableRow>
  );
}

export default function RefreshTokenList(props) {
  const { tokens } = props;
  const { email, roles, host } = useUserState();
  console.log(tokens);
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell align="left">Refresh Token</TableCell>
            <TableCell align="left">User Id</TableCell>
            <TableCell align="left">Host</TableCell>
            <TableCell align="left">Timestamp</TableCell>
            <TableCell align="right">Detail</TableCell>
            <TableCell align="right">Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tokens.map((token, index) => (
            <Row
              history={props.history}
              email={email}
              roles={roles}
              host={host}
              key={index}
              row={token}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
