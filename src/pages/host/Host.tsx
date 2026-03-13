import CircularProgress from "@mui/material/CircularProgress";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import { useEffect, useState, useCallback, ReactNode } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useUserState } from "../../contexts/UserContext";
import { extractDomainFromEmail } from "../../utils";
import fetchClient from "../../utils/fetchClient";

interface HostData {
  hostId: string;
  domain: string;
  subDomain: string;
  hostDesc?: string;
  hostOwner?: string;
  updateUser?: string;
  updateTs?: string;
}

interface RowProps {
  row: HostData;
}

function Row({ row }: RowProps) {
  return (
    <TableRow sx={{ "& > *": { borderBottom: "unset" } }} key={`${row.hostId}`}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.domain}</TableCell>
      <TableCell align="left">{row.subDomain}</TableCell>
      <TableCell align="left">{row.hostDesc}</TableCell>
      <TableCell align="left">{row.hostOwner}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
    </TableRow>
  );
}

interface HostListProps {
  hosts: HostData[];
}

function HostList({ hosts }: HostListProps) {
  return (
    <TableBody>
      {hosts && hosts.length > 0 ? (
        hosts.map((host, index) => <Row key={index} row={host} />)
      ) : (
        <TableRow>
          <TableCell colSpan={7} align="center">
            No hosts found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

export default function Host() {
  const { email } = useUserState();
  const [domain, setDomain] = useState(extractDomainFromEmail(email) || "");
  const [subDomain, setSubDomain] = useState("");
  const debouncedSubDomain = useDebounce(subDomain, 1000);
  const [hostDesc, setHostDesc] = useState("");
  const debouncedHostDesc = useDebounce(hostDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();
  const [hosts, setHosts] = useState<HostData[]>([]);

  const handleDomainChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(event.target.value);
  };

  const handleSubDomainChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubDomain(event.target.value);
  };

  const handleHostDescChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHostDesc(event.target.value);
  };

  const fetchData = useCallback(async (url: string, headers?: Record<string, string>) => {
    try {
      setLoading(true);
      const data = await fetchClient(url, { headers });
      console.log(data);
      setHosts(data);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!domain) return;

    const cmd = {
      host: "lightapi.net",
      service: "host",
      action: "getHostByDomain",
      version: "0.1.0",
      data: {
        domain: domain,
        subDomain: debouncedSubDomain,
        hostDesc: debouncedHostDesc,
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    fetchData(url);
  }, [domain, debouncedSubDomain, debouncedHostDesc, fetchData]);

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
        <TableContainer component={Paper}>
          <Table aria-label="Host table">
            <TableHead>
              <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
                <TableCell align="left">Host Id</TableCell>
                <TableCell align="left">
                  <TextField
                    variant="standard"
                    placeholder="Domain"
                    value={domain}
                    onChange={handleDomainChange}
                    size="small"
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    variant="standard"
                    placeholder="Sub Domain"
                    value={subDomain}
                    onChange={handleSubDomainChange}
                    size="small"
                  />
                </TableCell>
                <TableCell align="left">
                  <TextField
                    variant="standard"
                    placeholder="Host Desc"
                    value={hostDesc}
                    onChange={handleHostDescChange}
                    size="small"
                  />
                </TableCell>
                <TableCell align="left"></TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Ts</TableCell>
              </TableRow>
            </TableHead>
            <HostList hosts={hosts} />
          </Table>
        </TableContainer>
      </Box>
    );
  }
  return <Box className="Host">{content}</Box>;
}
