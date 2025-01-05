import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody"; // Import TableBody
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
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
  const { row } = props;
  const classes = useRowStyles();

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete the attribute for the api?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteAttributePermission",
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
      <TableCell align="left">{row.attributeId}</TableCell>
      <TableCell align="left">{row.attributeType}</TableCell>
      <TableCell align="left">{row.attributeValue}</TableCell>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiVersion}</TableCell>
      <TableCell align="left">{row.endpoint}</TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    attributeId: PropTypes.string.isRequired,
    attributeType: PropTypes.string,
    attributeValue: PropTypes.string,
    apiId: PropTypes.string,
    apiVersion: PropTypes.string,
    endpoint: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function AttributePermissionList(props) {
  const { attributePermissions } = props;
  return (
    <TableBody>
      {attributePermissions && attributePermissions.length > 0 ? (
        attributePermissions.map((attributePermission, index) => (
          <Row key={index} row={attributePermission} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No permissions assigned to this attribute.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

AttributePermissionList.propTypes = {
  attributePermissions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function AttributePermission(props) {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [attributeId, setAttributeId] = useState("");
  const debouncedAttributeId = useDebounce(attributeId, 1000);
  const [attributeType, setAttributeType] = useState("");
  const debouncedAttributeType = useDebounce(attributeType, 1000);
  const [attributeValue, setAttributeValue] = useState("");
  const debouncedAttributeValue = useDebounce(attributeValue, 1000);
  const [apiId, setApiId] = useState("");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiVersion, setApiVersion] = useState("");
  const debouncedApiVersion = useDebounce(apiVersion, 1000);
  const [endpoint, setEndpoint] = useState("");
  const debouncedEndpoint = useDebounce(endpoint, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [attributePermissions, setAttributePermissions] = useState([]);

  const handleAttributeIdChange = (event) => {
    setAttributeId(event.target.value);
  };
  const handleAttributeTypeChange = (event) => {
    setAttributeType(event.target.value);
  };
  const handleAttributeValueChange = (event) => {
    setAttributeValue(event.target.value);
  };
  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };
  const handleApiVersionChange = (event) => {
    setApiVersion(event.target.value);
  };
  const handleEndpointChange = (event) => {
    setEndpoint(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setAttributePermissions([]);
      } else {
        const data = await response.json();
        setAttributePermissions(data.attributes);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setAttributePermissions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "queryAttributePermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        attributeId: debouncedAttributeId,
        attributeType: debouncedAttributeType,
        attributeValue: debouncedAttributeValue,
        apiId: debouncedApiId,
        apiVersion: debouncedApiVersion,
        endpoint: debouncedEndpoint,
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
    debouncedAttributeId,
    debouncedAttributeType,
    debouncedAttributeValue,
    debouncedApiId,
    debouncedApiVersion,
    debouncedEndpoint,
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
    navigate("/app/form/createAttributePermission");
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
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Id"
                    value={attributeId}
                    onChange={handleAttributeIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Type"
                    value={attributeId}
                    onChange={handleAttributeTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Value"
                    value={attributeId}
                    onChange={handleAttributeValueChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Id"
                    value={apiId}
                    onChange={handleApiIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Version"
                    value={apiVersion}
                    onChange={handleApiVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Endpoint"
                    value={endpoint}
                    onChange={handleEndpointChange}
                  />
                </TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <AttributePermissionList
              attributePermissions={attributePermissions}
            />
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

  return <div className="App">{content}</div>;
}
