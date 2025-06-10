// this is a component to fetch a list of blog and display them in pagination
import TablePagination from "@mui/material/TablePagination";
import React, { useEffect, useState } from "react";
// import { makeStyles } from '@mui/styles';
// import Table from '@mui/material/Table';
// import TableBody from '@mui/material/TableBody';
// import TableCell from '@mui/material/TableCell';
// import TableContainer from '@mui/material/TableContainer';
// import TableHead from '@mui/material/TableHead';
// import TableRow from '@mui/material/TableRow';
// import Paper from '@mui/material/Paper';
// import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
// import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import BlogListItem from "./BlogListItem";
import useStyles from "./styles";

export default function BlogList(props) {
  console.log("BlogList props", props);
  const classes = useStyles();
  const { email, roles, host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [count, setCount] = useState(0);
  const [blogs, setBlogs] = useState([]);

  const cmd = {
    host: "lightapi.net",
    service: "blog",
    action: "getBlogList",
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

  console.log(blogs);
  let Blogs = undefined;
  if (Array.isArray(blogs)) {
    Blogs = blogs.map((data) => (
      <BlogListItem {...props} data={data} key={data.id} />
    ));
  }

  return (
    <div>
      {Blogs}
      <TablePagination
        rowsPerPageOptions={[10, 25, 100]}
        component="div"
        count={count}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </div>
  );
}
