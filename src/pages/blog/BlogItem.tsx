import { CircularProgress, Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import fetchClient from "../../utils/fetchClient";
// @ts-ignore
import MarkdownEditor from "@uiw/react-markdown-editor";
import { timeConversion } from "../../utils";

interface BlogData {
  title: string;
  author: string;
  publishDate: number;
  body: string;
}

export default function BlogItem() {
  const { host, id } = useParams<{ host: string; id: string }>();
  const [blog, setBlog] = useState<BlogData | null>(null);
  const [loading, setLoading] = useState(true);

  const queryBlogFn = async (url: string) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setBlog(data);
    } catch (e) {
      console.log(e);
      setBlog(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (host && id) {
      const cmd = {
        host: "lightapi.net",
        service: "blog",
        action: "getBlogById",
        version: "0.1.0",
        data: { host, id },
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      queryBlogFn(url);
    }
  }, [host, id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!blog) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Blog not found or failed to load.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {blog.title}
      </Typography>
      <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.secondary' }}>
        Posted by <Box component="span" sx={{ fontWeight: 'bold' }}>{blog.author}</Box>{" "}
        {timeConversion(new Date().getTime() - blog.publishDate)} ago
      </Typography>
      <Content body={blog.body} />
    </Box>
  );
}

const Content = ({ body }: { body: string }) => {
  return (
    <Box sx={{ mt: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
      <MarkdownEditor.Markdown source={body} />
    </Box>
  );
};
