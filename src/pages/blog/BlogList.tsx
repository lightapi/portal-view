import TablePagination from "@mui/material/TablePagination";
import React, { useEffect, useState, ReactNode } from "react";
import Box from "@mui/material/Box";
import fetchClient from "../../utils/fetchClient";
import { useUserState } from "../../contexts/UserContext";
import BlogListItem from "./BlogListItem";

interface BlogData {
    id: string;
    host: string;
    title: string;
    author: string;
    summary: string;
    publishDate: number;
    featuredImageUrl?: string;
    tags: string[];
}

export default function BlogList() {
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [count, setCount] = useState(0);
  const [blogs, setBlogs] = useState<BlogData[]>([]);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "blog",
      action: "getBlogList",
      version: "0.1.0",
      data: { host: host || "", offset: page * rowsPerPage, limit: rowsPerPage },
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

  let content: ReactNode;
  if (loading) {
      content = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>Loading blogs...</Box>;
  } else if (error) {
      content = <Box sx={{ p: 3, color: 'error.main' }}>Error: {JSON.stringify(error)}</Box>;
  } else if (Array.isArray(blogs)) {
    content = blogs.map((data) => (
      <BlogListItem data={data} key={data.id} />
    ));
  }

  return (
    <Box className="App">
      {content}
      <TablePagination
        rowsPerPageOptions={[10, 25, 100]}
        component="div"
        count={count}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
}
