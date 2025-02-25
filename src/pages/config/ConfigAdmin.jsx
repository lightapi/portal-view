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
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import YardIcon from "@mui/icons-material/Yard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import AppsIcon from "@mui/icons-material/Apps";
import ApiIcon from "@mui/icons-material/Api";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js"; // Make sure this hook is correctly implemented
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this exists
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

  const handleUpdate = (config) => {
    navigate("/app/form/updateConfig", { state: { data: { ...config } } });
  };

  const handleProperty = (config) => {
    navigate("/app/config/configProperty", { state: { data: { ...config } } });
  };

  const handleEnvironment = (config) => {
    navigate("/app/config/configEnvironment", {
      state: { data: { ...config } },
    });
  };
  const handleProduct = (config) => {
    navigate("/app/config/configProduct", { state: { data: { ...config } } });
  };
  const handleProductVersion = (config) => {
    navigate("/app/config/configProductVersion", {
      state: { data: { ...config } },
    });
  };
  const handleInstance = (config) => {
    navigate("/app/config/configInstance", { state: { data: { ...config } } });
  };
  const handleInstanceApi = (config) => {
    navigate("/app/config/configInstanceApi", {
      state: { data: { ...config } },
    });
  };
  const handleInstanceApp = (config) => {
    navigate("/app/config/configInstanceApp", {
      state: { data: { ...config } },
    });
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this config?")) {
      const cmd = {
        host: "lightapi.net",
        service: "config",
        action: "deleteConfig",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command", // Adjust if you use a different command endpoint
        headers: {},
        body: cmd,
      });

      if (result.data) {
        // Refresh after successful deletion.  Consider using state update instead of reload
        window.location.reload();
      } else if (result.error) {
        console.error("API Error:", result.error);
        //  Optionally show an error message to the user
      }
    }
  };

  return (
    <TableRow className={classes.root} key={row.configId}>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.configPhase}</TableCell>
      <TableCell align="left">{row.configType}</TableCell>
      <TableCell align="left">{row.light4jVersion}</TableCell>
      <TableCell align="left">{row.classPath}</TableCell>
      <TableCell align="left">{row.configDesc}</TableCell>
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
      <TableCell align="right">
        <FormatListBulletedIcon onClick={() => handleProperty(row)} />
      </TableCell>
      <TableCell align="right">
        <YardIcon onClick={() => handleEnvironment(row)} />
      </TableCell>
      <TableCell align="right">
        <Inventory2Icon onClick={() => handleProduct(row)} />
      </TableCell>
      <TableCell align="right">
        <AddToDriveIcon onClick={() => handleProductVersion(row)} />
      </TableCell>
      <TableCell align="right">
        <InstallMobileIcon onClick={() => handleInstance(row)} />
      </TableCell>
      <TableCell align="right">
        <ApiIcon onClick={() => handleInstanceApi(row)} />
      </TableCell>
      <TableCell align="right">
        <AppsIcon onClick={() => handleInstanceApp(row)} />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string,
    configPhase: PropTypes.string,
    configType: PropTypes.string,
    light4jVersion: PropTypes.string,
    classPath: PropTypes.string,
    configDesc: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigList(props) {
  const { configs } = props;
  return (
    <TableBody>
      {configs && configs.length > 0 ? (
        configs.map((config, index) => <Row key={index} row={config} />)
      ) : (
        <TableRow>
          <TableCell colSpan={8} align="center">
            No configs found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigList.propTypes = {
  configs: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState(); // Get host from UserContext
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [configId, setConfigId] = useState("");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState("");
  const debouncedConfigName = useDebounce(configName, 1000);
  const [configPhase, setConfigPhase] = useState("");
  const debouncedConfigPhase = useDebounce(configPhase, 1000);
  const [configType, setConfigType] = useState("");
  const debouncedConfigType = useDebounce(configType, 1000);
  const [light4jVersion, setLight4jVersion] = useState("");
  const debouncedLight4jVersion = useDebounce(light4jVersion, 1000);
  const [classPath, setClassPath] = useState("");
  const debouncedClassPath = useDebounce(classPath, 1000);
  const [configDesc, setConfigDesc] = useState("");
  const debouncedConfigDesc = useDebounce(configDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configs, setConfigs] = useState([]);

  const handleConfigIdChange = (event) => {
    setConfigId(event.target.value);
  };
  const handleConfigNameChange = (event) => {
    setConfigName(event.target.value);
  };
  const handleConfigPhaseChange = (event) => {
    setConfigPhase(event.target.value);
  };

  const handleConfigTypeChange = (event) => {
    setConfigType(event.target.value);
  };

  const handleLight4jVersionChange = (event) => {
    setLight4jVersion(event.target.value);
  };
  const handleClassPathChange = (event) => {
    setClassPath(event.target.value);
  };

  const handleConfigDescChange = (event) => {
    setConfigDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigs([]);
      } else {
        const data = await response.json();
        console.log("Fetched data:", data);
        setConfigs(data.configs || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfig",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        configPhase: debouncedConfigPhase,
        configType: debouncedConfigType,
        light4jVersion: debouncedLight4jVersion,
        classPath: debouncedClassPath,
        configDesc: debouncedConfigDesc,
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
    debouncedConfigId,
    debouncedConfigName,
    debouncedConfigPhase,
    debouncedConfigType,
    debouncedLight4jVersion,
    debouncedClassPath,
    debouncedConfigDesc,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createConfig"); // Adjust the path as needed
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
          <Table aria-label="config table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Id"
                    value={configId}
                    onChange={handleConfigIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Name"
                    value={configName}
                    onChange={handleConfigNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Phase"
                    value={configPhase}
                    onChange={handleConfigPhaseChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Type"
                    value={configType}
                    onChange={handleConfigTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Light4j Version"
                    value={light4jVersion}
                    onChange={handleLight4jVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Class Path"
                    value={classPath}
                    onChange={handleClassPathChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Desc"
                    value={configDesc}
                    onChange={handleConfigDescChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Property</TableCell>
                <TableCell align="right">Environment</TableCell>
                <TableCell align="right">Product</TableCell>
                <TableCell align="right">Product Version</TableCell>
                <TableCell align="right">Instance</TableCell>
                <TableCell align="right">Instance Api</TableCell>
                <TableCell align="right">Instance App</TableCell>
              </TableRow>
            </TableHead>
            <ConfigList configs={configs} />
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
        <AddBoxIcon onClick={handleCreate} />
      </div>
    );
  }

  return <div className="ConfigAdmin">{content}</div>;
}
