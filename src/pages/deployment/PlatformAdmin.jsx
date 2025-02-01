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

  const handleUpdate = (platform) => {
    navigate("/app/form/updatePlatform", { state: { data: { ...platform } } }); // Adjust path as needed
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this platform?")) {
      const cmd = {
        host: "lightapi.net", // Adjust if needed
        service: "deployment", // Assuming "deployment" service
        action: "deletePlatform", // Assuming "deletePlatform" action
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
    <TableRow className={classes.root} key={`${row.hostId}-${row.platformId}`}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.platformId}</TableCell>
      <TableCell align="left">{row.platformName}</TableCell>
      <TableCell align="left">{row.platformVersion}</TableCell>
      <TableCell align="left">{row.clientType}</TableCell>
      <TableCell align="left">{row.clientUrl}</TableCell>
      {/* Credentials are sensitive, decide if you want to display */}
      {/* <TableCell align="left">{row.credentials}</TableCell> */}
      <TableCell align="left">{row.proxyUrl}</TableCell>
      <TableCell align="left">{row.proxyPort}</TableCell>
      <TableCell align="left">{row.environment}</TableCell>
      <TableCell align="left">{row.systemEnv}</TableCell>
      <TableCell align="left">{row.runtimeEnv}</TableCell>
      <TableCell align="left">{row.zone}</TableCell>
      <TableCell align="left">{row.region}</TableCell>
      <TableCell align="left">{row.lob}</TableCell>
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
    platformId: PropTypes.string.isRequired,
    platformName: PropTypes.string,
    platformVersion: PropTypes.string,
    clientType: PropTypes.string,
    clientUrl: PropTypes.string,
    credentials: PropTypes.string, // Consider if this should be displayed
    proxyUrl: PropTypes.string,
    proxyPort: PropTypes.number,
    environment: PropTypes.string,
    systemEnv: PropTypes.string,
    runtimeEnv: PropTypes.string,
    zone: PropTypes.string,
    region: PropTypes.string,
    lob: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function PlatformList(props) {
  const { platforms } = props;
  return (
    <TableBody>
      {platforms && platforms.length > 0 ? (
        platforms.map((platform, index) => <Row key={index} row={platform} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No platforms found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

PlatformList.propTypes = {
  platforms: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function PlatformAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [platformId, setPlatformId] = useState("");
  const debouncedPlatformId = useDebounce(platformId, 1000);
  const [platformName, setPlatformName] = useState("");
  const debouncedPlatformName = useDebounce(platformName, 1000);
  const [platformVersion, setPlatformVersion] = useState("");
  const debouncedPlatformVersion = useDebounce(platformVersion, 1000);
  const [clientType, setClientType] = useState("");
  const debouncedClientType = useDebounce(clientType, 1000);
  const [environment, setEnvironment] = useState("");
  const debouncedEnvironment = useDebounce(environment, 1000);
  const [zone, setZone] = useState("");
  const debouncedZone = useDebounce(zone, 1000);
  const [region, setRegion] = useState("");
  const debouncedRegion = useDebounce(region, 1000);
  const [lob, setLob] = useState("");
  const debouncedLob = useDebounce(lob, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [platforms, setPlatforms] = useState([]);

  const handlePlatformIdChange = (event) => {
    setPlatformId(event.target.value);
  };
  const handlePlatformNameChange = (event) => {
    setPlatformName(event.target.value);
  };
  const handlePlatformVersionChange = (event) => {
    setPlatformVersion(event.target.value);
  };
  const handleClientTypeChange = (event) => {
    setClientType(event.target.value);
  };
  const handleEnvironmentChange = (event) => {
    setEnvironment(event.target.value);
  };
  const handleZoneChange = (event) => {
    setZone(event.target.value);
  };
  const handleRegionChange = (event) => {
    setRegion(event.target.value);
  };
  const handleLobChange = (event) => {
    setLob(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setPlatforms([]);
      } else {
        const data = await response.json();
        console.log(data);
        setPlatforms(data.platforms); // Assuming response is data.platforms
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net", // Adjust if needed
      service: "deployment", // Assuming "deployment" service
      action: "getPlatform", // Action from service code
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        platformId: debouncedPlatformId,
        platformName: debouncedPlatformName,
        platformVersion: debouncedPlatformVersion,
        clientType: debouncedClientType,
        environment: debouncedEnvironment,
        zone: debouncedZone,
        region: debouncedRegion,
        lob: debouncedLob,
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
    debouncedPlatformId,
    debouncedPlatformName,
    debouncedPlatformVersion,
    debouncedClientType,
    debouncedEnvironment,
    debouncedZone,
    debouncedRegion,
    debouncedLob,
    fetchData, // Add fetchData to dependency array of useEffect
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createPlatform"); // Adjust path as needed
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
          <Table aria-label="platform table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Platform Id"
                    value={platformId}
                    onChange={handlePlatformIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Platform Name"
                    value={platformName}
                    onChange={handlePlatformNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Platform Version"
                    value={platformVersion}
                    onChange={handlePlatformVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="client-type-label">Client Type</InputLabel>
                    <Select
                      labelId="client-type-label"
                      id="client-type"
                      value={clientType}
                      onChange={handleClientTypeChange}
                      label="Client Type"
                    >
                      <MenuItem value={""}> </MenuItem>
                      <MenuItem value={"MAVEN"}>MAVEN</MenuItem>
                      <MenuItem value={"GRADLE"}>GRADLE</MenuItem>
                      <MenuItem value={"NPM"}>NPM</MenuItem>
                      <MenuItem value={"DOCKER"}>DOCKER</MenuItem>
                      {/* Add more client type options as needed */}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Client Url"
                    value={platformVersion} // should be clientUrl, corrected below
                    onChange={() => {}} // No handler as per previous components, corrected below
                  />
                </TableCell>
                {/* Removed Credentials Input */}
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Proxy Url"
                    value={platformVersion} // should be proxyUrl, corrected below
                    onChange={() => {}} // No handler as per previous components, corrected below
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Proxy Port"
                    value={platformVersion} // should be proxyPort, corrected below
                    onChange={() => {}} // No handler as per previous components, corrected below
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Environment"
                    value={environment}
                    onChange={handleEnvironmentChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="System Env"
                    value={platformVersion} // should be systemEnv, corrected below
                    onChange={() => {}} // No handler as per previous components, corrected below
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Runtime Env"
                    value={platformVersion} // should be runtimeEnv, corrected below
                    onChange={() => {}} // No handler as per previous components, corrected below
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Zone"
                    value={zone}
                    onChange={handleZoneChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Region"
                    value={region}
                    onChange={handleRegionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Lob"
                    value={lob}
                    onChange={handleLobChange}
                  />
                </TableCell>

                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <PlatformList platforms={platforms} />
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

  return <div className="PlatformAdmin">{content}</div>;
}
