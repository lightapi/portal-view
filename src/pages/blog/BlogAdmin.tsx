// import AddBoxIcon from '@mui/material/icons/AddBox';
import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import { makeStyles } from "@mui/styles";
import React, { useEffect, useState } from "react";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import useStyles from "./styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { history, email, roles, host, id } = props;
  const classes = useRowStyles();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleUpdate = () => {
    const cmd = {
      host: "lightapi.net",
      service: "blog",
      action: "getBlogById",
      version: "0.1.0",
      data: { host, id },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({ pathname: "/app/form/updateBlog", state: { data } });
    };

    const query = async (url, headers, callback) => {
      try {
        setLoading(true);
        const response = await fetch(url, { headers, credentials: "include" });
        if (!response.ok) {
          const error = await response.json();
          setLoading(false);
          setError(error.description);
        } else {
          const data = await response.json();
          setLoading(false);
          callback(data);
        }
      } catch (e) {
        console.log(e);
        setError(e);
        setLoading(false);
      }
    };
    query(url, headers, callback);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete the client?")) {
      history.push({
        pathname: "/app/oauth/deleteClient",
        state: { data: { host, id } },
      });
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="left">{id}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={handleUpdate} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={handleDelete} />
      </TableCell>
    </TableRow>
  );
}

function BlogAdminList(props) {
  const { history, blogs } = props;
  const { email, roles, host } = useUserState();
  console.log(blogs);
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell align="left">Host</TableCell>
            <TableCell align="left">Id</TableCell>
            <TableCell align="right">Update</TableCell>
            <TableCell align="right">Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {blogs.map((blog, index) => (
            <Row
              history={history}
              email={email}
              roles={roles}
              host={host}
              key={index}
              id={blog}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function BlogAdmin(props) {
  const classes = useStyles();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [count, setCount] = useState(0);
  const [blogs, setBlogs] = useState([]);

  const cmd = {
    host: "lightapi.net",
    service: "blog",
    action: "getBlog",
    version: "0.1.0",
    data: { host, offset: page * rowsPerPage, limit: rowsPerPage },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  const query = async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setBlogs([]);
      } else {
        const data = await response.json();
        setBlogs(data.blogs);
        setCount(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setBlogs([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    query(url, headers);
  }, [page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    props.history.push("/app/form/createBlog");
  };

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    wait = (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    wait = (
      <div>
        <BlogAdminList {...props} blogs={blogs} />
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={count}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
        <AddBoxIcon onClick={() => handleCreate()} />
      </div>
    );
  }

  return <div className="App">{wait}</div>;
}
