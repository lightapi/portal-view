import CircularProgress from "@mui/material/CircularProgress";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js"; // Assuming this hook exists
import { useLocation } from "react-router-dom";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row } = props;
  const classes = useRowStyles();

  return (
    <TableRow className={classes.root} key={`${row.providerId}-${row.kid}`}>
      <TableCell align="left">{row.providerId}</TableCell>
      <TableCell align="left">{row.kid}</TableCell>
      <TableCell align="left">{row.keyType}</TableCell>
      <TableCell align="left">{row.publicKey}</TableCell>
      <TableCell align="left">{row.privateKey}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    providerId: PropTypes.string.isRequired,
    kid: PropTypes.string.isRequired,
    keyType: PropTypes.string.isRequired,
    publicKey: PropTypes.string,
    privateKey: PropTypes.string,
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
  const [providerId, setProviderId] = useState(data?.providerId || "");
  const [kid, setKid] = useState("");
  const debouncedKid = useDebounce(kid, 1000);
  const [keyType, setKeyType] = useState("");
  const debouncedKeyType = useDebounce(keyType, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [providerKeys, setProviderKeys] = useState([]);

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
        setProviderKeys(data);
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
    if (!providerId) return;

    const cmd = {
      host: "lightapi.net",
      service: "oauth",
      action: "getProviderKey",
      version: "0.1.0",
      data: {
        providerId: providerId,
        kid: debouncedKid,
        keyType: debouncedKeyType,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [providerId, debouncedKid, debouncedKeyType, fetchData]);

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
                <TableCell align="left">Public Key</TableCell>
                <TableCell align="left">Private Key</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Ts</TableCell>
              </TableRow>
            </TableHead>
            <ProviderKeyList providerKeys={providerKeys} />
          </Table>
        </TableContainer>
      </div>
    );
  }

  return <div className="ProviderKey">{content}</div>;
}
