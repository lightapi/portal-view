import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (client) => {
    if (client.appId != null) {
      navigate("/app/form/updateAppClient", { state: { data: { ...client } } });
    } else if (client.apiId != null) {
      navigate("/app/form/updateApiClient", { state: { data: { ...client } } });
    }
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      const cmd = {
        host: "lightapi.net", // Adjust as needed
        service: "oauth", //  Adjust to your service.
        action: "deleteClient", // Adjust
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command", // Adjust if your command endpoint differs
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refresh after deletion (consider using state update instead of reload)
        window.location.reload();
      } else if (result.error) {
        console.error("API Error", result.error);
      }
    }
  };

  return (
    <TableRow className={classes.root} key={`${row.hostId}-${row.clientId}`}>
      <TableCell align="left">{row.clientId}</TableCell>
      <TableCell align="left">{row.clientName}</TableCell>
      <TableCell align="left">{row.appId}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.clientType}</TableCell>
      <TableCell align="left">{row.clientProfile}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    clientId: PropTypes.string.isRequired,
    clientName: PropTypes.string.isRequired,
    appId: PropTypes.string,
    apiId: PropTypes.string,
    clientType: PropTypes.string.isRequired,
    clientProfile: PropTypes.string.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
    // Omitted: clientSecret, clientScope, customClaim, redirectUri, authenticateClass, derefClientId.  Add back if needed.
  }).isRequired,
};

function ClientList(props) {
  const { clients } = props;
  return (
    <TableBody>
      {clients && clients.length > 0 ? (
        clients.map((client, index) => <Row key={index} row={client} />)
      ) : (
        <TableRow>
          <TableCell colSpan={10} align="center">
            {" "}
            {/* Adjust colSpan as needed*/}
            No clients found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ClientList.propTypes = {
  clients: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function Client() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [clientId, setClientId] = useState("");
  const debouncedClientId = useDebounce(clientId, 1000);
  const [clientName, setClientName] = useState("");
  const debouncedClientName = useDebounce(clientName, 1000);
  const [appId, setAppId] = useState(() => data?.appId || "");
  const debouncedAppId = useDebounce(appId, 1000);
  const [apiId, setApiId] = useState(() => data?.apiId || "");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [clientType, setClientType] = useState("");
  const [clientProfile, setClientProfile] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Use null initially for consistency
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState([]);

  const handleClientIdChange = (event) => {
    setClientId(event.target.value);
  };
  const handleClientNameChange = (event) => {
    setClientName(event.target.value);
  };
  const handleAppIdChange = (event) => {
    setAppId(event.target.value);
  };
  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };
  const handleClientTypeChange = (event) => {
    setClientType(event.target.value);
  };
  const handleClientProfileChange = (event) => {
    setClientProfile(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred."); // More robust error handling
        setClients([]);
      } else {
        const data = await response.json();
        setClients(data.clients || []); // Handle potential missing data
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error."); // Clearer error message
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net", // Adjust if needed
      service: "oauth", // Adjust to your service
      action: "getClient", // Adjust based on your backend
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        clientId: debouncedClientId,
        clientName: debouncedClientName,
        appId: debouncedAppId,
        apiId: debouncedApiId,
        clientType: clientType, // Not debounced, sent directly
        clientProfile: clientProfile, // Not debounced
      },
    };

    const url = `/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`;
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedClientId,
    debouncedClientName,
    debouncedAppId,
    debouncedApiId,
    clientType, // Include in dependencies
    clientProfile, // Include in dependencies
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (appId, apiId) => {
    if (appId != null && appId.length > 0) {
      // Checks if appId is not null or undefined
      navigate("/app/form/createAppClient", { state: { data: { appId } } });
    } else if (apiId != null && apiId.length > 0) {
      // Checks if apiId is not null or undefined
      navigate("/app/form/createApiClient", { state: { data: { apiId } } });
    }
  };

  let content;

  if (loading) {
    content = <CircularProgress />;
  } else if (error) {
    content = <div style={{ color: "red" }}>Error: {error}</div>;
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="client table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Client Id"
                    value={clientId}
                    onChange={handleClientIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Client Name"
                    value={clientName}
                    onChange={handleClientNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="App Id"
                    value={appId}
                    onChange={handleAppIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="API Id"
                    value={apiId}
                    onChange={handleApiIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Client Type"
                    value={clientType}
                    onChange={handleClientTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Client Profile"
                    value={clientProfile}
                    onChange={handleClientProfileChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ClientList clients={clients} />
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
        <AddBoxIcon onClick={() => handleCreate(appId, apiId)} />
      </div>
    );
  }

  return <div className="ClientAdmin">{content}</div>;
}
