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
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { useUserState } from "../../contexts/UserContext";
import { extractDomainFromEmail } from "../../utils";

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
    <TableRow className={classes.root} key={`${row.hostId}`}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.domain}</TableCell>
      <TableCell align="left">{row.subDomain}</TableCell>
      <TableCell align="left">{row.hostDesc}</TableCell>
      <TableCell align="left">{row.hostOwner}</TableCell>
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
    hostId: PropTypes.string.isRequired,
    domain: PropTypes.string.isRequired,
    subDomain: PropTypes.string.isRequired,
    hostDesc: PropTypes.string,
    hostOwner: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function HostList(props) {
  const { hosts } = props;
  return (
    <TableBody>
      {hosts && hosts.length > 0 ? (
        hosts.map((host, index) => <Row key={index} row={host} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No hosts found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

HostList.propTypes = {
  hosts: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function Host() {
  const classes = useRowStyles();
  const { email } = useUserState();
  const [domain, setDomain] = useState(extractDomainFromEmail(email) || "");
  const [subDomain, setSubDomain] = useState("");
  const debouncedSubDomain = useDebounce(subDomain, 1000);
  const [hostDesc, setHostDesc] = useState("");
  const debouncedHostDesc = useDebounce(hostDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [hosts, setHosts] = useState([]);

  const handleDomainChange = (event) => {
    setDomain(event.target.value);
  };

  const handleSubDomainChange = (event) => {
    setSubDomain(event.target.value);
  };

  const handleHostDescChange = (event) => {
    setHostDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setHosts([]);
      } else {
        const data = await response.json();
        console.log(data);
        setHosts(data);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!domain) return;

    const cmd = {
      host: "lightapi.net",
      service: "host",
      action: "getHostByDomain",
      version: "0.1.0",
      data: {
        domain: domain,
        subDomain: debouncedSubDomain,
        hostDesc: debouncedHostDesc,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [domain, debouncedSubDomain, debouncedHostDesc, fetchData]);

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
          <Table aria-label="Host table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host Id</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Domain"
                    value={domain}
                    onChange={handleDomainChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Sub Domain"
                    value={subDomain}
                    onChange={handleSubDomainChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Host Desc"
                    value={hostDesc}
                    onChange={handleHostDescChange}
                  />
                </TableCell>
                <TableCell align="left"></TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Ts</TableCell>
              </TableRow>
            </TableHead>
            <HostList hosts={hosts} />
          </Table>
        </TableContainer>
      </div>
    );
  }
  return <div className="Host">{content}</div>;
}
