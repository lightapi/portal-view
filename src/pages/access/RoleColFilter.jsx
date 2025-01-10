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
      window.confirm("Are you sure you want to delete the role column filter?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteRoleColFilter",
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
      <TableCell align="left">{row.roleId}</TableCell>
      <TableCell align="left">{row.tableId}</TableCell>
      <TableCell align="left">{row.columnId}</TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    roleId: PropTypes.string.isRequired,
    tableId: PropTypes.string.isRequired,
    columnId: PropTypes.string.isRequired,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function RoleColFilterList(props) {
  const { roleColFilters } = props;
  return (
    <TableBody>
      {roleColFilters && roleColFilters.length > 0 ? (
        roleColFilters.map((roleColFilter, index) => (
          <Row key={index} row={roleColFilter} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={4} align="center">
            No column filters assigned to this role.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

RoleColFilterList.propTypes = {
  roleColFilters: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RoleColFilter(props) {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [roleId, setRoleId] = useState("");
  const debouncedRoleId = useDebounce(roleId, 1000);
  const [tableId, setTableId] = useState("");
  const debouncedTableId = useDebounce(tableId, 1000);
  const [columnId, setColumnId] = useState("");
  const debouncedColumnId = useDebounce(columnId, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [roleColFilters, setRoleColFilters] = useState([]);

  const handleRoleIdChange = (event) => {
    setRoleId(event.target.value);
  };
  const handleTableIdChange = (event) => {
    setTableId(event.target.value);
  };
  const handleColumnIdChange = (event) => {
    setColumnId(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRoleColFilters([]);
      } else {
        const data = await response.json();
        setRoleColFilters(data.roleColFilters);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRoleColFilters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "market",
      action: "queryRoleColFilter",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        roleId: debouncedRoleId,
        tableId: debouncedTableId,
        columnId: debouncedColumnId,
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
    debouncedTableId,
    debouncedColumnId,
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
    navigate("/app/form/createRoleColFilter");
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
                    placeholder="Table Id"
                    value={tableId}
                    onChange={handleTableIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Column Id"
                    value={columnId}
                    onChange={handleColumnIdChange}
                  />
                </TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <RoleColFilterList roleColFilters={roleColFilters} />
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
