import React, { useState } from "react";
import makeStyles from "@mui/styles/makeStyles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import FilterListIcon from "@mui/icons-material/FilterList";
import AccessibleForwardIcon from "@mui/icons-material/AccessibleForward";
import CircularProgress from "@mui/material/CircularProgress";
import { useApiGet } from "../../hooks/useApiGet";
import { useUserState } from "../../contexts/UserContext";
import useStyles from "./styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row, history, host, serviceId, endpoint, endpointRules } = props;
  console.log(row, endpointRules);
  const classes = useRowStyles();

  let accesses = null;
  let filters = null;
  if (endpointRules) {
    let endpointRule = endpointRules[endpoint];
    if (endpointRule) {
      accesses = endpointRule["request-access"];
      filters = endpointRule["response-filter"];
    }
  }

  let scopes = row.scopes ? JSON.stringify(row.scopes, null, 2) : "N/A";
  let access = accesses ? JSON.stringify(accesses, null, 2) : "N/A";
  let filter = filters ? JSON.stringify(filters, null, 2) : "N/A";

  const updateAccess = () => {
    history.push({
      pathname: "/app/form/updateServiceAccess",
      state: {
        data: {
          host,
          serviceId,
          endpoint,
          access: row.access ? access : null,
          accesses,
        },
      },
    });
  };
  const updateFilter = () => {
    history.push({
      pathname: "/app/form/updateServiceFilter",
      state: {
        data: {
          host,
          serviceId,
          endpoint,
          filter: row.filter ? filter : null,
          filters,
        },
      },
    });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{serviceId}</TableCell>
      <TableCell align="left">{endpoint}</TableCell>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="left">{scopes}</TableCell>
      <TableCell align="left">{access}</TableCell>
      <TableCell align="left">{filter}</TableCell>
      <TableCell align="right">
        <AccessibleForwardIcon onClick={() => updateAccess(serviceId)} />
      </TableCell>
      <TableCell align="right">
        <FilterListIcon onClick={() => updateFilter(serviceId)} />
      </TableCell>
    </TableRow>
  );
}

export default function ServiceEndpoint(props) {
  const serviceId = props.location.state.data.serviceId;
  const { history } = props;
  const classes = useStyles();
  const { host } = useUserState();
  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getServiceById",
    version: "0.1.0",
    data: { serviceId, host },
  };
  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const { isLoading, data } = useApiGet({ url, headers });

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    let endpoints = data.endpoints;
    wait = (
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell align="left">Service Id</TableCell>
              <TableCell align="left">Endpoint</TableCell>
              <TableCell align="left">Host</TableCell>
              <TableCell align="left">Scopes</TableCell>
              <TableCell align="left">Access</TableCell>
              <TableCell align="left">Filter</TableCell>
              <TableCell align="right">Update Access</TableCell>
              <TableCell align="right">Update Filter</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(endpoints).map((key) => (
              <Row
                history={props.history}
                host={host}
                serviceId={serviceId}
                endpoint={key}
                key={key}
                row={endpoints[key]}
                endpointRules={data.endpointRules}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return <div className="App">{wait}</div>;
}
