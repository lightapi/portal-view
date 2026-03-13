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
import React, { useEffect, useState, ReactNode } from "react";
import fetchClient from "../../utils/fetchClient";
import { useUserState } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface RowProps {
  hostId: string;
  errorCode: string;
}

function Row({ hostId, errorCode }: RowProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    const cmd = {
      host: "lightapi.net",
      service: "error",
      action: "getErrorByCode",
      version: "0.1.0",
      data: { host: hostId, errorCode },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setLoading(false);
      navigate("/app/form/updateError", { state: { data } });
    } catch (e: any) {
      console.log(e);
      alert(e.description || e.message || e);
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete the error?")) {
      navigate("/app/error/deleteError", {
        state: { data: { host: hostId, errorCode } },
      });
    }
  };

  return (
    <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
      <TableCell align="left">{hostId}</TableCell>
      <TableCell align="left">{errorCode}</TableCell>
      <TableCell align="right">
        {loading ? <CircularProgress size={20} /> : <SystemUpdateIcon sx={{ cursor: 'pointer' }} onClick={handleUpdate} />}
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon sx={{ cursor: 'pointer', color: 'error.main' }} onClick={handleDelete} />
      </TableCell>
    </TableRow>
  );
}

interface ErrorAdminListProps {
  errors: string[];
  hostId: string;
}

function ErrorAdminList({ errors, hostId }: ErrorAdminListProps) {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell align="left">Host</TableCell>
            <TableCell align="left">Error Code</TableCell>
            <TableCell align="right">Update</TableCell>
            <TableCell align="right">Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {errors.map((item, index) => (
            <Row
              hostId={hostId}
              key={index}
              errorCode={item}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ErrorAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const fetchErrors = async () => {
      const cmd = {
        host: "lightapi.net",
        service: "error",
        action: "getError",
        version: "0.1.0",
        data: { host, offset: page * rowsPerPage, limit: rowsPerPage },
      };
    
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      try {
        setLoading(true);
        const data = await fetchClient(url);
        setErrors(data.errors || []);
        setCount(data.total || 0);
        setLoading(false);
      } catch (e: any) {
        console.log(e);
        setError(e.description || e.message || e);
        setErrors([]);
        setLoading(false);
      }
    };

    fetchErrors();
  }, [page, rowsPerPage, host]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createError");
  };

  let wait: ReactNode;
  if (loading) {
    wait = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    wait = (
      <Box sx={{ p: 3 }}>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  } else {
    wait = (
      <Box>
        <ErrorAdminList errors={errors} hostId={host || ''} />
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
          <AddBoxIcon sx={{ cursor: 'pointer', fontSize: 40, color: 'primary.main' }} onClick={() => handleCreate()} />
        </Box>
      </Box>
    );
  }

  return <Box className="App">{wait}</Box>;
}
