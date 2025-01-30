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
import SettingsIcon from "@mui/icons-material/Settings";

import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost";

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

  const handleUpdate = (host) => {
    navigate("/app/form/updateHost", { state: { data: { ...host } } });
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this host?")) {
      const cmd = {
        host: "lightapi.net",
        service: "host",
        action: "deleteHost",
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

  const handleHostDetail = (hostId) => {
    navigate("/app/host/hostDetail", { state: { data: { hostId } } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.domain}</TableCell>
      <TableCell align="left">{row.subDomain}</TableCell>
      <TableCell align="left">{row.hostDesc}</TableCell>
      <TableCell align="left">{row.hostOwner}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <SettingsIcon onClick={() => handleHostDetail(row.hostId)} />
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

export default function HostAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [hostId, setHostId] = useState("");
  const debouncedHostId = useDebounce(hostId, 1000);
  const [domain, setDomain] = useState("");
  const debouncedDomain = useDebounce(domain, 1000);
  const [subDomain, setSubDomain] = useState("");
  const debouncedSubDomain = useDebounce(subDomain, 1000);
  const [hostDesc, setHostDesc] = useState("");
  const debouncedHostDesc = useDebounce(hostDesc, 1000);
  const [hostOwner, setHostOwner] = useState("");
  const debouncedHostOwner = useDebounce(hostOwner, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [hosts, setHosts] = useState([]);

  const handleHostIdChange = (event) => {
    setHostId(event.target.value);
  };

  const handleDomainChange = (event) => {
    setDomain(event.target.value);
  };

  const handleSubDomainChange = (event) => {
    setSubDomain(event.target.value);
  };

  const handleHostDescChange = (event) => {
    setHostDesc(event.target.value);
  };

  const handleHostOwnerChange = (event) => {
    setHostOwner(event.target.value);
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
        console.log("data = ", data);
        setHosts(data.hosts);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "host",
      action: "getHost",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: debouncedHostId,
        domain: debouncedDomain,
        subDomain: debouncedSubDomain,
        hostDesc: debouncedHostDesc,
        hostOwner: debouncedHostOwner,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    debouncedHostId,
    debouncedDomain,
    debouncedSubDomain,
    debouncedHostDesc,
    debouncedHostOwner,
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
    navigate("/app/form/createHost"); // Adjust path as needed
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
          <Table aria-label="host table">
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
                    placeholder="Domain"
                    value={domain}
                    onChange={handleDomainChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="SubDomain"
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
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Host Owner"
                    value={hostOwner}
                    onChange={handleHostOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Timestamp</TableCell>
                <TableCell align="right">Detail</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <HostList hosts={hosts} />
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

  return <div className="HostAdmin">{content}</div>;
}
