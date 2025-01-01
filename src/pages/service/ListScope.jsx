import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useLocation } from "react-router-dom";
import { useApiGet } from "../../hooks/useApiGet";
import useStyles from "./styles";

export default function ListScope() {
  const classes = useStyles();
  const location = useLocation();
  const { hostId, apiId, apiVersion, endpoint } = location.state;

  console.log(hostId, apiId, apiVersion, endpoint);

  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getEndpointScope",
    version: "0.1.0",
    data: { hostId, apiId, apiVersion, endpoint },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  console.log(url);
  const headers = {};

  const { isLoading, data } = useApiGet({ url, headers });

  let content;
  if (isLoading) {
    content = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host Id</TableCell>
                <TableCell align="left">Api Id</TableCell>
                <TableCell align="left">Api Version</TableCell>
                <TableCell align="left">Endpoint</TableCell>
                <TableCell align="left">Scope</TableCell>
                <TableCell align="left">Scope Desc</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data &&
                data.map((row, index) => (
                  <TableRow key={index} className={classes.root}>
                    <TableCell align="left">{row.hostId}</TableCell>
                    <TableCell align="left">{row.apiId}</TableCell>
                    <TableCell align="left">{row.apiVersion}</TableCell>
                    <TableCell align="left">{row.endpoint}</TableCell>
                    <TableCell align="left">{row.scope}</TableCell>
                    <TableCell align="left">{row.scopeDesc}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
