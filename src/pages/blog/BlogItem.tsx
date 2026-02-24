import React, { useEffect, useState } from "react";
import fetchClient from "../../utils/fetchClient";
import MarkdownEditor from "@uiw/react-markdown-editor";
import { timeConversion } from "../../utils";
import useStyles from "./styles";

export default function BlogItem(props) {
  const classes = useStyles();
  console.log(props.match.params.host);
  console.log(props.match.params.id);
  const host = props.match.params.host;
  const id = props.match.params.id;
  const [blog, setBlog] = useState();
  const [loading, setLoading] = useState(true);

  const cmd = {
    host: "lightapi.net",
    service: "blog",
    action: "getBlogById",
    version: "0.1.0",
    data: { host, id },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

  const queryBlogFn = async (url) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setBlog(data);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    queryBlogFn(url);
  }, []);

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    console.log("blog = ", blog);
    wait = (
      <div>
        <h1 className={classes.title}>{blog.title}</h1>
        Posted by <span className={classes.author}>{blog.author}</span>{" "}
        {timeConversion(new Date().getTime() - blog.publishDate)} ago
        <Content body={blog.body} />
      </div>
    );
  }

  return <div>{wait}</div>;
}

const Content = ({ body }) => {
  console.log("body = ", body);
  return (
    <div className={classes.content}>
      <MarkdownEditor.Markdown source={body} height="200px" />
    </div>
  );
};
