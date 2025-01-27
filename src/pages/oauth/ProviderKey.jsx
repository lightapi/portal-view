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
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this context exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming this apiPost function exists
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

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

  const handleUpdate = (providerKey) => {
    navigate("/app/form/updateProviderKey", {
      state: { data: { ...providerKey } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this auth provider key for the host?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "oauth",
        action: "deleteProviderKey",
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
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.providerId}-${row.kid}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.providerId}</TableCell>
      <TableCell align="left">{row.kid}</TableCell>
      <TableCell align="left">{row.keyType}</TableCell>
      {/* PublicKey and PrivateKey are too long, might want to display in detail view */}
      {/* <TableCell align="left">{row.publicKey}</TableCell> */}
      {/* <TableCell align="left">{row.privateKey}</TableCell> */}
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
    kid: PropTypes.string.isRequired,
    keyType: PropTypes.string.isRequired,
    publicKey: PropTypes.string, // Optional, depending on if you want to display it
    privateKey: PropTypes.string, // Optional, depending on if you want to display it
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ProviderKeyList(props) {
  const { providerKeys } = props;
  return (
    <TableBody>
      {providerKeys && providerKeys.length > 0 ? (
        providerKeys.map((providerKey, index) => (
          <Row key={index} row={providerKey} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No auth provider keys found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ProviderKeyList.propTypes = {
  providerKeys: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ProviderKey() {
  const classes = useRowStyles();
  const location = useLocation();
  const data = location.state?.data;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [hostId, setHostId] = useState(data?.hostId || "");
  const [providerId, setProviderId] = useState(data?.providerId || "");
  const [kid, setKid] = useState("");
  const debouncedKid = useDebounce(kid, 1000);
  const [keyType, setKeyType] = useState("");
  const debouncedKeyType = useDebounce(keyType, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [providerKeys, setProviderKeys] = useState([]);

  const handleHostIdChange = (event) => {
    setHostId(event.target.value);
  };

  const handleProviderIdChange = (event) => {
    setProviderId(event.target.value);
  };

  const handleKidChange = (event) => {
    setKid(event.target.value);
  };
  const handleKeyTypeChange = (event) => {
    setKeyType(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProviderKeys([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProviderKeys(data.providerKeys);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setProviderKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hostId || !providerId) return; // Ensure hostId and providerId are available

    const cmd = {
      host: "lightapi.net",
      service: "oauth",
      action: "getProviderKey",
      version: "0.1.0",
      data: {
        hostId: hostId,
        providerId: providerId,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        kid: debouncedKid,
        keyType: debouncedKeyType,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    hostId,
    providerId,
    debouncedKid,
    debouncedKeyType,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
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
          <Table aria-label="provider key table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Host Id"
                    value={hostId}
                    onChange={handleHostIdChange}
                  />
                </TableCell>
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
                    placeholder="Kid"
                    value={kid}
                    onChange={handleKidChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="key-type-label">Key Type</InputLabel>
                    <Select
                      labelId="key-type-label"
                      id="key-type"
                      value={keyType}
                      onChange={handleKeyTypeChange}
                      label="Key Type"
                    >
                      <MenuItem value={""}></MenuItem>
                      <MenuItem value={"LC"}>Long Currnet</MenuItem>
                      <MenuItem value={"LP"}>Long Previous</MenuItem>
                      <MenuItem value={"TC"}>Token Current</MenuItem>
                      <MenuItem value={"TP"}>Token Previous</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ProviderKeyList providerKeys={providerKeys} />
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
      </div>
    );
  }

  return <div className="ProviderKey">{content}</div>;
}
