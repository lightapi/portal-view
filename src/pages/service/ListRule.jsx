import { CircularProgress } from "@mui/material";
import { useApiGet } from "../../hooks/useApiGet";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
} from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";

import useStyles from "./styles";

export default function ListRule() {
  const classes = useStyles();
  const location = useLocation();
  const { hostId, apiId, apiVersion, endpoint } = location.state;
  const navigate = useNavigate();

  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getEndpointRule",
    version: "0.1.0",
    data: { hostId, apiId, apiVersion, endpoint },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  console.log(url);
  const headers = {};

  const { isLoading, data } = useApiGet({ url, headers });

  const handleAddRule = () => {
    navigate("/app/form/createEndpointRule", {
      state: { data: { hostId, apiId, apiVersion, endpoint } },
    });
  };

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
                <TableCell align="left">Rule Type</TableCell>
                <TableCell align="left">Rule Id</TableCell>
                <TableCell align="left">Rule Name</TableCell>
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
                    <TableCell align="left">{row.ruleType}</TableCell>
                    <TableCell align="left">{row.ruleId}</TableCell>
                    <TableCell align="left">{row.ruleName}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <AddBoxIcon onClick={() => handleAddRule()} />
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
