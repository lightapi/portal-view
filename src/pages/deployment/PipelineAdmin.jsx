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
import useDebounce from "../../hooks/useDebounce.js"; // Ensure this hook is implemented
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Ensure UserContext is available
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Make sure apiPost is correctly implemented

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

  const handleUpdate = (pipeline) => {
    navigate("/app/form/updatePipeline", { state: { data: { ...pipeline } } }); // Adjust path
  };

  const handleDelete = async (row) => {
    if (window.confirm("Are you sure you want to delete this pipeline?")) {
      const cmd = {
        host: "lightapi.net",
        service: "deployment",
        action: "deletePipeline",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command", // Adjust if your command endpoint differs
        headers: {},
        body: cmd,
      });

      if (result.data) {
        window.location.reload(); // Consider a state update instead of reload
      } else if (result.error) {
        console.error("API Error:", result.error);
        // Optionally show an error message to the user
      }
    }
  };

  return (
    <TableRow className={classes.root} key={`${row.hostId}-${row.pipelineId}`}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.pipelineId}</TableCell>
      <TableCell align="left">{row.platformId}</TableCell>
      <TableCell align="left">{row.endpoint}</TableCell>
      <TableCell align="left">{row.requestSchema}</TableCell>
      <TableCell align="left">{row.responseSchema}</TableCell>
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
    pipelineId: PropTypes.string.isRequired,
    platformId: PropTypes.string.isRequired,
    endpoint: PropTypes.string.isRequired,
    requestSchema: PropTypes.string,
    responseSchema: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function PipelineList(props) {
  const { pipelines } = props;
  return (
    <TableBody>
      {pipelines && pipelines.length > 0 ? (
        pipelines.map((pipeline, index) => <Row key={index} row={pipeline} />)
      ) : (
        <TableRow>
          <TableCell colSpan={7} align="center">
            {" "}
            {/*Adjust colSpan*/}
            No pipelines found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

PipelineList.propTypes = {
  pipelines: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function PipelineAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState(); // Get host from UserContext

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [pipelineId, setPipelineId] = useState("");
  const debouncedPipelineId = useDebounce(pipelineId, 1000);
  const [platformId, setPlatformId] = useState("");
  const debouncedPlatformId = useDebounce(platformId, 1000);
  const [endpoint, setEndpoint] = useState("");
  const debouncedEndpoint = useDebounce(endpoint, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [pipelines, setPipelines] = useState([]);

  const handlePipelineIdChange = (event) => {
    setPipelineId(event.target.value);
  };

  const handleEndpointChange = (event) => {
    setEndpoint(event.target.value);
  };

  const handlePlatformIdChange = (event) => {
    setPlatformId(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setPipelines([]);
      } else {
        const data = await response.json();
        setPipelines(data.pipelines || []); // Adjust response key if needed
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "deployment",
      action: "getPipeline",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        pipelineId: debouncedPipelineId,
        platformId: debouncedPlatformId,
        endpoint: debouncedEndpoint,
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
    debouncedPipelineId,
    debouncedPlatformId,
    debouncedEndpoint,
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
    navigate("/app/form/createPipeline");
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
          <Table aria-label="pipeline table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Id"
                    value={pipelineId}
                    onChange={handlePipelineIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="PlatformId"
                    value={platformId}
                    onChange={handlePlatformIdChange}
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
                <TableCell align="left">Request Schema</TableCell>
                <TableCell align="left">Response Schema</TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <PipelineList pipelines={pipelines} />
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

  return <div className="PipelineAdmin">{content}</div>;
}
