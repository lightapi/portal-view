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
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import CameraRollIcon from "@mui/icons-material/CameraRoll";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
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

  const handleUpdate = (role) => {
    console.log("role = ", role);
    navigate("/app/form/updateRole", { state: { data: { ...role } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the role for the host?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteRole",
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

  const handleRolePermission = (role) => {
    console.log("role", role);
    navigate("/app/access/rolePermission", { state: { role } });
  };

  const handleRoleRowFilter = (role) => {
    navigate("/app/access/roleRowFilter", { state: { role } });
  };

  const handleRoleColFilter = (role) => {
    navigate("/app/access/roleColFilter", { state: { role } });
  };

  const handleRoleUser = (roleId) => {
    navigate("/app/access/roleUser", { state: { data: { roleId } } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.roleId}</TableCell>
      <TableCell align="left">{row.roleDesc}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon onClick={() => handleRolePermission(row)} />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon onClick={() => handleRoleRowFilter(row)} />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() => handleRoleColFilter(row)}
        />
      </TableCell>
      <TableCell align="right">
        <CameraRollIcon onClick={() => handleRoleUser(row.roleId)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    roleId: PropTypes.string.isRequired,
    roleDesc: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function RoleList(props) {
  const { roles } = props;
  return (
    <TableBody>
      {roles && roles.length > 0 ? (
        roles.map((role, index) => <Row key={index} row={role} />)
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No roles found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RoleList.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RoleAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [roleId, setRoleId] = useState("");
  const debouncedRoleId = useDebounce(roleId, 1000);
  const [roleDesc, setRoleDesc] = useState("");
  const debouncedRoleDesc = useDebounce(roleDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState([]);

  const handleRoleIdChange = (event) => {
    setRoleId(event.target.value);
  };
  const handleRoleDescChange = (event) => {
    setRoleDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRoles([]);
      } else {
        const data = await response.json();
        setRoles(data.roles);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "getRole",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        roleId: debouncedRoleId,
        roleDesc: debouncedRoleDesc,
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
    debouncedRoleId,
    debouncedRoleDesc,
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
    navigate("/app/form/createRole");
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
                    placeholder="Role Id"
                    value={roleId}
                    onChange={handleRoleIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Role Desc"
                    value={roleDesc}
                    onChange={handleRoleDescChange}
                  />
                </TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Role Permission</TableCell>
                <TableCell align="right">Role Row Filter</TableCell>
                <TableCell align="right">Role Col Filter</TableCell>
                <TableCell align="right">Role User</TableCell>
              </TableRow>
            </TableHead>
            <RoleList roles={roles} />
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
