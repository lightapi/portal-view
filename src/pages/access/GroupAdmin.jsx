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
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import DetailsIcon from "@mui/icons-material/Details";
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
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (group) => {
    navigate("/app/form/updateGroup", { state: { data: { ...group } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the group for the host?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteGroup",
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

  const handleApiGroup = (group) => {
    console.log("group", group);
    navigate("/app/apiGroup", { state: { group } });
  };

  const handleUserGroup = (group) => {
    console.log("group", group);
    navigate("/app/userGroup", { state: { group } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.groupId}</TableCell>
      <TableCell align="left">{row.groupDesc}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleApiGroup(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleUserGroup(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    groupId: PropTypes.string.isRequired,
    groupDesc: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function GroupList(props) {
  const { groups } = props;
  return (
    <TableBody>
      {groups && groups.length > 0 ? (
        groups.map((group, index) => <Row key={index} row={group} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No groups found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

GroupList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function GroupAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [groupId, setGroupId] = useState("");
  const debouncedGroupId = useDebounce(groupId, 1000);
  const [groupDesc, setGroupDesc] = useState("");
  const debouncedGroupDesc = useDebounce(groupDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState([]);

  const handleGroupIdChange = (event) => {
    setGroupId(event.target.value);
  };
  const handleGroupDescChange = (event) => {
    setGroupDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setGroups([]);
      } else {
        const data = await response.json();
        setGroups(data.groups);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "getGroup",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        groupId: debouncedGroupId,
        groupDesc: debouncedGroupDesc,
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
    debouncedGroupId,
    debouncedGroupDesc,
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
    navigate("/app/form/createGroup");
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
                    placeholder="Group Id"
                    value={groupId}
                    onChange={handleGroupIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Group Desc"
                    value={groupDesc}
                    onChange={handleGroupDescChange}
                  />
                </TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Api Group</TableCell>
                <TableCell align="right">User Group</TableCell>
              </TableRow>
            </TableHead>
            <GroupList groups={groups} />
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
