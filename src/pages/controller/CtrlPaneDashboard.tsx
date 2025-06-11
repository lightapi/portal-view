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
import Cookies from 'universal-cookie';
import { makeStyles } from '@mui/styles';
import React, { useEffect, useState } from 'react';
import { useAppState } from '../../contexts/AppContext';
// import './Dashboard.css';

const useRowStyles = makeStyles({
  root: {
    '& > *': {
      borderBottom: 'unset',
    },
  },
});

function CtrlPaneDashboard(props) {
  const { history } = props;
  const [services, setServices] = useState(false);
  const serviceIds = services ? Object.keys(services) : [];
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { filter } = useAppState(false);
  const filteredServiceIds = serviceIds.filter(
    (serviceId) => serviceId.toLowerCase().includes(filter) || !filter
  );
  const url = '/services';

  useEffect(() => {
    const cookies = new Cookies();
    const abortController = new AbortController();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(url, {
          headers, credentials: 'include',
          signal: abortController.signal,
        });
        if (!response.ok) {
          const data = await response.json();
          setLoading(false);
          setError(data);
        } else {
          const data = await response.json();
          setServices(data);
          setLoading(false);
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

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
  } else if (services) {
    wait = (
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
                history={props.history}
                id={id}
                nodes={services[id]}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  return <div className="App">{wait}</div>;
}

function Row(props) {
  const { id, nodes, history } = props;
  const [open, setOpen] = React.useState(false);
  const classes = useRowStyles();
  const words = id.split('|');
  const serviceId = words[0];
  const tag = words[1];

  const handleCheck = (node) => {
    const k = id + ':' + node.protocol + ':' + node.address + ':' + node.port;
    console.log("pushing to the /app/controller/check with id = ", k);
    history.push({ pathname: '/app/controller/check', state: { data: { id: k } } });
  };

  const handleLogger = (node) => {
    history.push({ pathname: '/app/controller/logger', state: { data: { node } } });
  };

  const handleInfo = (node) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    const fullNode = node.address + ':' + node.port;
    history.push({
      pathname: '/app/controller/info',
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

  const handleChaosMonkey = (node) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    history.push({
      pathname: '/app/controller/chaos',
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
      <TableRow className={classes.root}>
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
