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

  const handleUpdate = (configInstanceFile) => {
    navigate("/app/form/updateConfigInstanceFile", {
      state: { data: { ...configInstanceFile } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this config instance file?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "config",
        action: "deleteConfigInstanceFile",
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
        // Optionally show an error message to the user
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.instanceFileId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.instanceFileId}</TableCell>
      <TableCell align="left">{row.instanceId}</TableCell>
      <TableCell align="left">{row.instanceName}</TableCell>
      <TableCell align="left">{row.fileType}</TableCell>
      <TableCell align="left">{row.fileName}</TableCell>
      <TableCell align="left">{row.fileValue}</TableCell>
      <TableCell align="left">{row.fileDesc}</TableCell>
      <TableCell align="left">{row.expirationTs}</TableCell>
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
    instanceFileId: PropTypes.string.isRequired,
    instanceId: PropTypes.string.isRequired,
    instanceName: PropTypes.string.isRequired,
    fileType: PropTypes.string.isRequired,
    fileName: PropTypes.string.isRequired,
    fileValue: PropTypes.string.isRequired,
    fileDesc: PropTypes.string.isRequired,
    expirationTs: PropTypes.string.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigInstanceFileList(props) {
  const { configInstanceFiles } = props;
  return (
    <TableBody>
      {configInstanceFiles && configInstanceFiles.length > 0 ? (
        configInstanceFiles.map((configInstanceFile, index) => (
          <Row key={index} row={configInstanceFile} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={12} align="center">
            {" "}
            {/*Adjust colSpan*/}
            No config instance files found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigInstanceFileList.propTypes = {
  configInstanceFiles: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigInstanceFile() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [instanceFileId, setInstanceFileId] = useState(
    () => data?.instanceFileId || "",
  );
  const debouncedInstanceFileId = useDebounce(instanceFileId, 1000);
  const [instanceId, setInstanceId] = useState(() => data?.instanceId || "");
  const debouncedInstanceId = useDebounce(instanceId, 1000);
  const [instanceName, setInstanceName] = useState("");
  const debouncedInstanceName = useDebounce(instanceName, 1000);

  const [fileType, setFileType] = useState("");
  const debouncedFileType = useDebounce(fileType, 1000);
  const [fileName, setFileName] = useState("");
  const debouncedFileName = useDebounce(fileName, 1000);
  const [fileValue, setFileValue] = useState("");
  const debouncedFileValue = useDebounce(fileValue, 1000);
  const [fileDesc, setFileDesc] = useState("");
  const debouncedFileDesc = useDebounce(fileDesc, 1000);
  const [expirationTs, setExpirationTs] = useState("");
  const debouncedExpirationTs = useDebounce(expirationTs, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configInstanceFiles, setConfigInstanceFiles] = useState([]);

  const handleInstanceFileIdChange = (event) => {
    setInstanceFileId(event.target.value);
  };
  const handleInstanceIdChange = (event) => {
    setInstanceId(event.target.value);
  };
  const handleInstanceNameChange = (event) => {
    setInstanceName(event.target.value);
  };
  const handleFileTypeChange = (event) => {
    setFileType(event.target.value);
  };
  const handleFileNameChange = (event) => {
    setFileName(event.target.value);
  };
  const handleFileValueChange = (event) => {
    setFileValue(event.target.value);
  };
  const handleFileDescChange = (event) => {
    setFileDesc(event.target.value);
  };
  const handleExpirationTsChange = (event) => {
    setExpirationTs(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigInstanceFiles([]);
      } else {
        const data = await response.json();
        setConfigInstanceFiles(data.instanceFiles || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigInstanceFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfigInstanceFile",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        instanceFileId: debouncedInstanceFileId,
        instanceId: debouncedInstanceId,
        instanceName: debouncedInstanceName,
        fileType: debouncedFileType,
        fileName: debouncedFileName,
        fileValue: debouncedFileValue,
        fileDesc: debouncedFileDesc,
        expirationTs: debouncedExpirationTs,
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
    debouncedInstanceFileId,
    debouncedInstanceId,
    debouncedInstanceName,
    debouncedFileType,
    debouncedFileName,
    debouncedFileValue,
    debouncedFileDesc,
    debouncedExpirationTs,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (instanceId) => {
    navigate("/app/form/createConfigInstanceFile", {
      state: { data: { instanceId } },
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
          <Table aria-label="config instance file table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance File Id"
                    value={instanceFileId}
                    onChange={handleInstanceFileIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance Id"
                    value={instanceId}
                    onChange={handleInstanceIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Instance Name"
                    value={instanceName}
                    onChange={handleInstanceNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="File Type"
                    value={fileType}
                    onChange={handleFileTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="File Name"
                    value={fileName}
                    onChange={handleFileNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="File Value"
                    value={fileValue}
                    onChange={handleFileValueChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="File Desc"
                    value={fileDesc}
                    onChange={handleFileDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Expiration Ts"
                    value={expirationTs}
                    onChange={handleExpirationTsChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ConfigInstanceFileList configInstanceFiles={configInstanceFiles} />
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
        <AddBoxIcon onClick={() => handleCreate(instanceId)} />
      </div>
    );
  }
  return <div className="ConfigInstanceFile">{content}</div>;
}
