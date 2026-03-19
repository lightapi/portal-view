import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HelpIcon from '@mui/icons-material/Help';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import fetchClient from '../../utils/fetchClient';
import React, { useEffect, useState, ReactNode } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';

interface Node {
  protocol: string;
  address: string;
  port: number;
}

interface Services {
  [key: string]: Node[];
}

function CtrlPaneDashboard() {
  const [services, setServices] = useState<Services | null>(null);
  const serviceIds = services ? Object.keys(services) : [];
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { filter } = useAppState() as { filter: string };
  const filteredServiceIds = serviceIds.filter(
    (serviceId) => serviceId.toLowerCase().includes(filter.toLowerCase()) || !filter
  );

  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const json = await fetchClient('/services', { signal: abortController.signal });
        setServices(json);
        setLoading(false);
      } catch (error: any) {
        if (!abortController.signal.aborted) {
          setLoading(false);
          setError(error);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

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
  } else if (services) {
    content = (
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Service Id</TableCell>
              <TableCell>Environment Tag</TableCell>
              <TableCell align="right">Number of Nodes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredServiceIds.map((id, i) => (
              <Row
                key={i}
                id={id}
                nodes={services[id]}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  return <Box className="App">{content}</Box>;
}

interface RowProps {
  id: string;
  nodes: Node[];
}

function Row({ id, nodes }: RowProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const words = id.split('|');
  const serviceId = words[0];
  const tag = words[1];

  const handleCheck = (node: Node) => {
    const k = id + ':' + node.protocol + ':' + node.address + ':' + node.port;
    navigate('/app/controller/check', { state: { data: { id: k } } });
  };

  const handleLogger = (node: any) => {
    navigate('/app/controller/logger', { state: { data: { node } } });
  };

  const handleInfo = (node: Node) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    const fullNode = node.address + ':' + node.port;
    navigate('/app/controller/info', {
      state: {
        data: {
          node: fullNode,
          protocol: node.protocol,
          address: node.address,
          port: node.port,
          baseUrl: originUrl,
        },
      },
    });
  };

  const handleChaosMonkey = (node: Node) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    navigate('/app/controller/chaos', {
      state: {
        data: {
          protocol: node.protocol,
          address: node.address,
          port: node.port,
          baseUrl: originUrl,
        },
      },
    });
  };

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {serviceId}
        </TableCell>
        <TableCell>{tag}</TableCell>
        <TableCell align="right">{nodes.length}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box margin={1}>
              <Typography variant="h6" gutterBottom component="div">
                Nodes
              </Typography>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell>Protocol</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell align="right">Port</TableCell>
                    <TableCell align="right">Status Check</TableCell>
                    <TableCell align="right">Server Info</TableCell>
                    <TableCell align="right">Logger Config</TableCell>
                    <TableCell align="right">Chaos Monkey</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nodes.map((node, j) => (
                    <TableRow key={j}>
                      <TableCell component="th" scope="row">
                        {node.protocol}
                      </TableCell>
                      <TableCell>{node.address}</TableCell>
                      <TableCell align="right">{node.port}</TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleCheck(node)}>
                          <CloudDoneIcon />
                        </IconButton>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleInfo(node)}>
                          <HelpIcon />
                        </IconButton>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleLogger({ ...node, apiName: serviceId })}>
                          <PermDataSettingIcon />
                        </IconButton>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleChaosMonkey(node)}>
                          <AssessmentIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}

export default CtrlPaneDashboard;
