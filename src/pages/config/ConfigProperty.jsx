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
import useDebounce from "../../hooks/useDebounce.js"; // Ensure this hook exists
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming you have this function
import { stringToBoolean } from "../../utils/index.jsx";

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

  const handleUpdate = (configProperty) => {
    navigate("/app/form/updateConfigProperty", {
      state: { data: { ...configProperty } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete this config property?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "config",
        action: "deleteConfigProperty",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });

      if (result.data) {
        window.location.reload();
      } else if (result.error) {
        console.error("API Error:", result.error);
        // Optionally show an error to the user
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.configId}-${row.propertyName}`}
    >
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.propertyName}</TableCell>
      <TableCell align="left">{row.propertyType}</TableCell>
      <TableCell align="left">{row.light4jVersion}</TableCell>
      <TableCell align="left">{row.displayOrder}</TableCell>
      <TableCell align="left">{row.required ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.propertyDesc}</TableCell>
      <TableCell align="left">{row.propertyValue}</TableCell>
      <TableCell align="left">{row.valueType}</TableCell>
      <TableCell align="left">{row.propertyFile}</TableCell>
      <TableCell align="left">{row.resourceType}</TableCell>
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
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string,
    propertyName: PropTypes.string.isRequired,
    propertyType: PropTypes.string,
    light4jVersion: PropTypes.string,
    displayOrder: PropTypes.number,
    required: PropTypes.bool,
    propertyDesc: PropTypes.string,
    propertyValue: PropTypes.string,
    valueType: PropTypes.string,
    propertyFile: PropTypes.string,
    resourceType: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigPropertyList(props) {
  const { configProperties } = props;
  return (
    <TableBody>
      {configProperties && configProperties.length > 0 ? (
        configProperties.map((configProperty, index) => (
          <Row key={index} row={configProperty} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={16} align="center">
            No config properties found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigPropertyList.propTypes = {
  configProperties: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigPropertyAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [configId, setConfigId] = useState(() => data?.configId || "");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState("");
  const debouncedConfigName = useDebounce(configName, 1000);
  const [propertyName, setPropertyName] = useState("");
  const debouncedPropertyName = useDebounce(propertyName, 1000);
  const [propertyType, setPropertyType] = useState("");
  const debouncedPropertyType = useDebounce(propertyType, 1000);
  const [light4jVersion, setLight4jVersion] = useState("");
  const debouncedLight4jVersion = useDebounce(light4jVersion, 1000);
  const [required, setRequired] = useState("");
  const debouncedRequired = useDebounce(required, 1000);
  const [valueType, setValueType] = useState("");
  const debouncedValueType = useDebounce(valueType, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configProperties, setConfigProperties] = useState([]);

  const handleConfigIdChange = (event) => {
    setConfigId(event.target.value);
  };
  const handleConfigNameChange = (event) => {
    setConfigName(event.target.value);
  };
  const handlePropertyNameChange = (event) => {
    setPropertyName(event.target.value);
  };
  const handlePropertyTypeChange = (event) => {
    setPropertyType(event.target.value);
  };
  const handleLight4jVersionChange = (event) => {
    setLight4jVersion(event.target.value);
  };

  const handleRequiredChange = (event) => {
    setRequired(event.target.value);
  };

  const handleValueTypeChange = (event) => {
    setValueType(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigProperties([]);
      } else {
        const data = await response.json();
        setConfigProperties(data.configProperties || []); // Adapt to your response structure
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfigProperty",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        propertyName: debouncedPropertyName,
        propertyType: debouncedPropertyType,
        light4jVersion: debouncedLight4jVersion,
        valueType: debouncedValueType,
        ...(debouncedRequired && debouncedRequired.trim() !== ""
          ? { required: stringToBoolean(debouncedRequired) }
          : {}), // Conditional spread
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
    debouncedPropertyName,
    debouncedPropertyType,
    debouncedLight4jVersion,
    debouncedRequired,
    debouncedValueType,
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
    navigate("/app/form/createConfigProperty", {
      state: { data: { configId } },
    });
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
          <Table aria-label="config property table">
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
                    placeholder="Property Name"
                    value={propertyName}
                    onChange={handlePropertyNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Type"
                    value={propertyType}
                    onChange={handlePropertyTypeChange}
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
                <TableCell align="left">Display Order</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Required"
                    value={required}
                    onChange={handleRequiredChange}
                  />
                </TableCell>
                <TableCell align="left">Property Desc</TableCell>
                <TableCell align="left">Property Value</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Value Type"
                    value={valueType}
                    onChange={handleValueTypeChange}
                  />
                </TableCell>
                <TableCell align="left">Property File</TableCell>
                <TableCell align="left">Resource Type</TableCell>

                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ConfigPropertyList configProperties={configProperties} />
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
        <AddBoxIcon onClick={() => handleCreate(configId)} />
      </div>
    );
  }
  return <div className="ConfigPropertyAdmin">{content}</div>;
}
