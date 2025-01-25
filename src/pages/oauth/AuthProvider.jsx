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
import useDebounce from "../../hooks/useDebounce.js"; // Assuming this hook exists
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this context exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming this apiPost function exists

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

  const handleUpdate = (provider) => {
    navigate("/app/form/updateProvider", { state: { data: { ...provider } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this auth provider for the host?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "oauth",
        action: "deleteProvider",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refresh the data after successful deletion
        window.location.reload();
      } else if (result.error) {
        console.error("Api Error", result.error);
      }
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.providerId}</TableCell>
      <TableCell align="left">{row.providerName}</TableCell>
      <TableCell align="left">{row.providerDesc}</TableCell>
      <TableCell align="left">{row.operationOwner}</TableCell>
      <TableCell align="left">{row.deliveryOwner}</TableCell>
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

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    providerId: PropTypes.string.isRequired,
    providerName: PropTypes.string,
    providerDesc: PropTypes.string,
    operationOwner: PropTypes.string,
    deliveryOwner: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function AuthProviderList(props) {
  const { providers } = props;
  return (
    <TableBody>
      {providers && providers.length > 0 ? (
        providers.map((provider, index) => <Row key={index} row={provider} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No auth providers found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

AuthProviderList.propTypes = {
  providers: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function AuthProvider() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [providerId, setProviderId] = useState("");
  const debouncedProviderId = useDebounce(providerId, 1000);
  const [providerName, setProviderName] = useState("");
  const debouncedProviderName = useDebounce(providerName, 1000);
  const [providerDesc, setProviderDesc] = useState("");
  const debouncedProviderDesc = useDebounce(providerDesc, 1000);
  const [operationOwner, setOperationOwner] = useState("");
  const debouncedOperationOwner = useDebounce(operationOwner, 1000);
  const [deliveryOwner, setDeliveryOwner] = useState("");
  const debouncedDeliveryOwner = useDebounce(deliveryOwner, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [providers, setProviders] = useState([]);

  const handleProviderIdChange = (event) => {
    setProviderId(event.target.value);
  };
  const handleProviderNameChange = (event) => {
    setProviderName(event.target.value);
  };
  const handleProviderDescChange = (event) => {
    setProviderDesc(event.target.value);
  };
  const handleOperationOwnerChange = (event) => {
    setOperationOwner(event.target.value);
  };
  const handleDeliveryOwnerChange = (event) => {
    setDeliveryOwner(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProviders([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProviders(data.providers);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "oauth",
      action: "getProvider",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        providerId: debouncedProviderId,
        providerName: debouncedProviderName,
        providerDesc: debouncedProviderDesc,
        operationOwner: debouncedOperationOwner,
        deliveryOwner: debouncedDeliveryOwner,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedProviderId,
    debouncedProviderName,
    debouncedProviderDesc,
    debouncedOperationOwner,
    debouncedDeliveryOwner,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createAuthProvider");
  };

  let content;
  if (loading) {
    content = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    content = (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Provider Id"
                    value={providerId}
                    onChange={handleProviderIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Provider Name"
                    value={providerName}
                    onChange={handleProviderNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Provider Desc"
                    value={providerDesc}
                    onChange={handleProviderDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Operation Owner"
                    value={operationOwner}
                    onChange={handleOperationOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Delivery Owner"
                    value={deliveryOwner}
                    onChange={handleDeliveryOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <AuthProviderList providers={providers} />
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
        <AddBoxIcon onClick={() => handleCreate()} />
      </div>
    );
  }

  return <div className="AuthProvider">{content}</div>;
}
