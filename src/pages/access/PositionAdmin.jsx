import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import PositionList from "./PositionList";
import { makeStyles } from "@mui/styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

export default function PositionAdmin(props) {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [positionId, setPositionId] = useState("");
  const debouncedPositionId = useDebounce(positionId, 1000);
  const [positionDesc, setPositionDesc] = useState("");
  const debouncedPositionDesc = useDebounce(positionDesc, 1000);
  const [inheritToAncestor, setInheritToAncestor] = useState("");
  const debouncedInheritToAncestor = useDebounce(inheritToAncestor, 1000);
  const [inheritToSibling, setInheritToSibling] = useState("");
  const debouncedInheritToSibling = useDebounce(inheritToSibling, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [positions, setPositions] = useState([]);

  const handlePositionIdChange = (event) => {
    setPositionId(event.target.value);
  };
  const handlePositionDescChange = (event) => {
    setPositionDesc(event.target.value);
  };
  const handleInheritToAncestorChange = (event) => {
    setInheritToAncestor(event.target.value);
  };
  const handleInheritToSiblingChange = (event) => {
    setInheritToSibling(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setPositions([]);
      } else {
        const data = await response.json();
        setPositions(data.positions);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "getPosition",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        positionId: debouncedPositionId,
        positionDesc: debouncedPositionDesc,
        inheritToAncestor: debouncedInheritToAncestor,
        inheritToSibling: debouncedInheritToSibling,
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
    debouncedPositionId,
    debouncedPositionDesc,
    debouncedInheritToAncestor,
    debouncedInheritToSibling,
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
    navigate("/app/form/createPosition");
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
                    placeholder="Position Id"
                    value={positionId}
                    onChange={handlePositionIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Position Desc"
                    value={positionDesc}
                    onChange={handlePositionDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Inherit To Ancestor"
                    value={inheritToAncestor}
                    onChange={handleInheritToAncestorChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Inherit To Sibling"
                    value={inheritToSibling}
                    onChange={handleInheritToSiblingChange}
                  />
                </TableCell>

                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Api Position</TableCell>
                <TableCell align="right">User Position</TableCell>
              </TableRow>
            </TableHead>
            <PositionList {...props} positions={positions} />
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
