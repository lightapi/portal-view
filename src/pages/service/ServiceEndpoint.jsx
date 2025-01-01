import { useNavigate, useLocation } from "react-router-dom";
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
import PropTypes from "prop-types";
import { useApiGet } from "../../hooks/useApiGet";
import useStyles from "./styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const navigate = useNavigate();
  Row.propTypes = {
    row: PropTypes.shape({
      hostId: PropTypes.string.isRequired,
      apiId: PropTypes.string.isRequired,
      apiVersion: PropTypes.string.isRequired,
      endpoint: PropTypes.string.isRequired,
      httpMethod: PropTypes.string.isRequired,
      endpointPath: PropTypes.string.isRequired,
      endpointDesc: PropTypes.string.isRequired,
    }).isRequired,
  };
  const { row } = props;
  console.log(row);
  const classes = useRowStyles();

  const listScopes = () => {
    navigate("/app/listScope", {
      state: {
        hostId: row.hostId,
        apiId: row.apiId,
        apiVersion: row.apiVersion,
        endpoint: row.endpoint,
      },
    });
  };
  const listRules = () => {
    navigate("/app/listRule", {
      state: {
        hostId: row.hostId,
        apiId: row.apiId,
        apiVersion: row.apiVersion,
        endpoint: row.endpoint,
      },
    });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.endpoint}</TableCell>
      <TableCell align="left">{row.httpMethod}</TableCell>
      <TableCell align="left">{row.endpointPath}</TableCell>
      <TableCell align="left">{row.endpointDesc}</TableCell>
      <TableCell align="right">
        <AccessibleForwardIcon onClick={() => listScopes(row)} />
      </TableCell>
      <TableCell align="right">
        <FilterListIcon onClick={() => listRules(row)} />
      </TableCell>
    </TableRow>
  );
}

export default function ServiceEndpoint() {
  const classes = useStyles();
  const location = useLocation();
  const { hostId, apiId, apiVersion } = location.state.data;

  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getServiceEndpoint",
    version: "0.1.0",
    data: { hostId, apiId, apiVersion },
  };
  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
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
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow className={classes.root}>
              <TableCell align="left">Host Id</TableCell>
              <TableCell align="left">Api Id</TableCell>
              <TableCell align="left">Api Version</TableCell>
              <TableCell align="left">Endpoint</TableCell>
              <TableCell align="left">HTTP Method</TableCell>
              <TableCell align="left">Endpoint Path</TableCell>
              <TableCell align="left">Endpoint Desc</TableCell>
              <TableCell align="right">Scopes</TableCell>
              <TableCell align="right">Rules</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data &&
              data.map((row) => (
                <Row
                  key={row.hostId + row.apiId + row.apiVersion + row.endpoint}
                  row={row}
                />
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return <div className="App">{content}</div>;
}
