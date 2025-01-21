import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
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

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row, history, email, roles, host } = props;
  const classes = useRowStyles();
  const fields = row.split("|");
  const clientId = fields[0];
  const clientName = fields[1];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleUpdate = (clientId) => {
    const cmd = {
      host: "lightapi.net",
      service: "client",
      action: "getClientById",
      version: "0.1.0",
      data: { clientId },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({ pathname: "/app/form/updateClient", state: { data } });
    };

    const queryClients = async (url, headers, callback) => {
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
    queryClients(url, headers, callback);
  };

  const handleToken = (clientId) => {
    history.push({
      pathname: "/app/form/testTokenForm",
      state: { data: { client_id: clientId, user_id: email, roles } },
    });
  };

  const handleDelete = (clientId) => {
    if (window.confirm("Are you sure you want to delete the client?")) {
      history.push({
        pathname: "/app/oauth/deleteClient",
        state: { data: { clientId } },
      });
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{clientId}</TableCell>
      <TableCell align="left">{clientName}</TableCell>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="right">
        <VpnKeyIcon onClick={() => handleToken(clientId)} />
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(clientId)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(clientId)} />
      </TableCell>
    </TableRow>
  );
}

export default function ClientList(props) {
  const { clients } = props;
  const { email, roles, host } = useUserState();
  console.log(clients);
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell align="left">Client Id</TableCell>
            <TableCell align="left">Client Name</TableCell>
            <TableCell align="left">Host</TableCell>
            <TableCell align="right">Token</TableCell>
            <TableCell align="right">Update</TableCell>
            <TableCell align="right">Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client, index) => (
            <Row
              history={props.history}
              email={email}
              roles={roles}
              host={host}
              key={index}
              row={client}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
