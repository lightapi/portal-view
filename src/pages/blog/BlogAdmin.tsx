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
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import React, { useEffect, useState, ReactNode } from "react";
import fetchClient from "../../utils/fetchClient";
import { useUserState } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface RowProps {
  id: string;
  host: string;
}

function Row({ id, host }: RowProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    const cmd = {
      host: "lightapi.net",
      service: "blog",
      action: "getBlogById",
      version: "0.1.0",
      data: { host, id },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setLoading(false);
      navigate("/app/form/updateBlog", { state: { data } });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this blog?")) {
      navigate("/app/blog/deleteBlog", {
        state: { data: { host, id } },
      });
    }
  };

  return (
    <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="left">{id}</TableCell>
      <TableCell align="right">
        <IconButton onClick={handleUpdate} disabled={loading} size="small">
          {loading ? <CircularProgress size={20} /> : <SystemUpdateIcon />}
        </IconButton>
      </TableCell>
      <TableCell align="right">
        <IconButton onClick={handleDelete} size="small" color="error">
          <DeleteForeverIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

interface BlogAdminListProps {
  blogs: string[];
}

function BlogAdminList({ blogs }: BlogAdminListProps) {
  const { host } = useUserState();
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
              host={host || ""}
              key={index}
              id={blog}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function BlogAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [count, setCount] = useState(0);
  const [blogs, setBlogs] = useState<string[]>([]);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "blog",
      action: "getBlog",
      version: "0.1.0",
      data: { host, offset: page * rowsPerPage, limit: rowsPerPage },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

    const query = async (url: string) => {
      try {
        setLoading(true);
        const data = await fetchClient(url);
        setBlogs(data.blogs || []);
        setCount(data.total || 0);
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        setError(e.description || e.message || e);
        setBlogs([]);
        setLoading(false);
      }
    };

    query(url);
  }, [page, rowsPerPage, host]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createBlog");
  };

  let content: ReactNode;
  if (loading) {
    content = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    content = (
      <Box sx={{ p: 3 }}>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  } else {
    content = (
      <Box>
        <BlogAdminList blogs={blogs} />
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={count}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton onClick={handleCreate} color="primary" size="large">
            <AddBoxIcon fontSize="large" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return <Box className="App">{content}</Box>;
}
