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
  const { hostId, endpointId } = location.state;

  console.log(hostId, endpointId);

  const cmd = {
    host: "lightapi.net",
    service: "service",
    action: "getApiEndpointScope",
    version: "0.1.0",
    data: { hostId, endpointId },
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
                <TableCell align="left">Endpoint</TableCell>
                <TableCell align="left">EndpointId</TableCell>
                <TableCell align="left">Scope</TableCell>
                <TableCell align="left">Scope Desc</TableCell>
                <TableCell align="left">Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data &&
                data.map((row, index) => (
                  <TableRow key={index} className={classes.root}>
                    <TableCell align="left">{row.hostId}</TableCell>
                    <TableCell align="left">{row.endpoint}</TableCell>
                    <TableCell align="left">{row.endpointId}</TableCell>
                    <TableCell align="left">{row.scope}</TableCell>
                    <TableCell align="left">{row.scopeDesc}</TableCell>
                    <TableCell align="left">{row.active}</TableCell>
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
