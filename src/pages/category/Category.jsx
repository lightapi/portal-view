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
import TableRow from "@mui/material/TableRow";
import { makeStyles } from "@mui/styles";
import React, { useState } from "react";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import { useApiGet } from "../../hooks/useApiGet";
import useStyles from "./styles";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { host, name, history } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const classes = useRowStyles();

  const handleUpdate = (name) => {
    const cmd = {
      host: "lightapi.net",
      service: "category",
      action: "getCategoryByName",
      version: "0.1.0",
      data: { host, name },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({
        pathname: "/app/form/updateCategory",
        state: { data: { host, name, categories: data } },
      });
    };

    const queryCategories = async (url, headers, callback) => {
      try {
        setLoading(true);
        const response = await fetch(url, { headers, credentials: "include" });
        if (!response.ok) {
          const error = await response.json();
          setError(error.description);
        } else {
          const data = await response.json();
          callback(data);
        }
        setLoading(false);
      } catch (e) {
        console.log(e);
        setError(e);
        setLoading(false);
      }
    };
    queryCategories(url, headers, callback);
  };

  const handleDelete = (name) => {
    if (window.confirm("Are you sure you want to delete the category?")) {
      props.history.push({
        pathname: "/app/category/deleteCategory",
        state: { data: { host, name } },
      });
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{host}</TableCell>
      <TableCell align="left">{name}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(name)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(name)} />
      </TableCell>
    </TableRow>
  );
}

export default function Category(props) {
  const classes = useStyles();
  const { host } = useUserState();
  const [categories, setCategories] = useState([]);

  const cmd = {
    host: "lightapi.net",
    service: "category",
    action: "getCategory",
    version: "0.1.0",
    data: { host },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const callback = (data) => {
    console.log("data = ", data);
    setCategories(data);
  };

  const { isLoading, data, error } = useApiGet({ url, headers, callback });
  console.log(isLoading, data, error);
  const handleCreate = () => {
    props.history.push({
      pathname: "/app/form/createCategory",
      state: { data: { host } },
    });
  };

  let wait;
  if (isLoading) {
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
    console.log(categories);
    wait = (
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell align="left">Host</TableCell>
              <TableCell align="left">Name</TableCell>
              <TableCell align="right">Update</TableCell>
              <TableCell align="right">Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category, index) => (
              <Row
                history={props.history}
                key={index}
                host={host}
                name={category}
              />
            ))}
          </TableBody>
        </Table>
        <AddBoxIcon onClick={() => handleCreate()} />
      </TableContainer>
    );
  }

  return <div className="App">{wait}</div>;
}
