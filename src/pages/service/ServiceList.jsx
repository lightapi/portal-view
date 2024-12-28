import React, { useState } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import SettingsIcon from '@mui/icons-material/Settings';
import ImageAspectRatioIcon from '@mui/icons-material/ImageAspectRatio';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import InputIcon from '@mui/icons-material/Input';
import BugReportIcon from '@mui/icons-material/BugReport';
import Cookies from 'universal-cookie'
import { useNavigate } from 'react-router-dom';

const useRowStyles = makeStyles({
  root: {
    '& > *': {
      borderBottom: 'unset',
    },
  },
});

function Row(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleUpdate = (serviceId) => {
    const cmd = {
      host: 'lightapi.net',
      service: 'market',
      action: 'getServiceById',
      version: '0.1.0',
      data: { serviceId }
    }
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
    const callback = (data) => {
      console.log("data = ", data);
      history.push({ pathname: '/app/form/updateService', state: { data } });
    }

    const queryServices = async (url, headers, callback) => {
      try {
        setLoading(true);
        const response = await fetch(url, { headers, credentials: 'include' });
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
    queryServices(url, headers, callback);
  };

  const handleDelete = (serviceId) => {
    if (window.confirm("Are you sure you want to delete the service?")) {
      navigate({ pathname: '/app/deleteService', state: { data: { serviceId } } });
    }
  };

  const handleSpec = (hostId, apiId, apiType) => {
    switch (apiType) {
      case 'openapi':
        navigate({ pathname: '/app/openapiEditor', state: { data: { hostId, apiId, apiType } } });
        break;
      case 'hybrid':
        navigate({ pathname: '/app/hybridEditor', state: { data: { hostId, apiId, apiType } } });
        break;
      case 'graphql':
        navigate({ pathname: '/app/graphqlEditor', state: { data: { hostId, apiId, apiType } } });
        break;
    }
  };

  const handleEndpoint = (serviceId, style, name) => {
    navigate({ pathname: '/app/serviceEndpoint', state: { data: { serviceId, style, name } } });
  };

  const handleCodegen = (serviceId, style, name) => {
    navigate({ pathname: '/app/serviceCodegen', state: { data: { serviceId, style, name } } });
  };

  const handleDeploy = (serviceId, style, name) => {
    navigate({ pathname: '/app/serviceDeploy', state: { data: { serviceId, style, name } } });
  };

  const handleTest = (serviceId, style, name) => {
    navigate({ pathname: '/app/serviceTest', state: { data: { serviceId, style, name } } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.serviceId}</TableCell>
      <TableCell align="left">{row.apiName}</TableCell>
      <TableCell align="left">{row.apiType}</TableCell>
      <TableCell align="left">{row.apiDesc}</TableCell>
      <TableCell align="left">{row.operationOwner}</TableCell>
      <TableCell align="left">{row.deliveryOwner}</TableCell>
      <TableCell align="left">{row.region}</TableCell>
      <TableCell align="left">{row.businessGroup}</TableCell>
      <TableCell align="left">{row.lob}</TableCell>
      <TableCell align="left">{row.platform}</TableCell>
      <TableCell align="left">{row.capability}</TableCell>
      <TableCell align="left">{row.gitRepo}</TableCell>
      <TableCell align="left">{row.apiTags}</TableCell>
      <TableCell align="left">{row.apiStatus}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(serviceId)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(serviceId)} />
      </TableCell>
      <TableCell align="right">
        <ImageAspectRatioIcon onClick={() => handleSpec(row.hostId, row.apiId, row.apiType)} />
      </TableCell>
      <TableCell align="right">
        <FormatListBulletedIcon onClick={() => handleEndpoint(serviceId, serviceSytle, name)} />
      </TableCell>
      <TableCell align="right">
        <InputIcon onClick={() => handleCodegen(serviceId, serviceSytle, name)} />
      </TableCell>
      <TableCell align="right">
        <SettingsIcon onClick={() => handleDeploy(serviceId, serviceSytle, name)} />
      </TableCell>
      <TableCell align="right">
        <BugReportIcon onClick={() => handleTest(serviceId, serviceSytle, name)} />
      </TableCell>
    </TableRow>
  );
}

export default function ServiceList(props) {
  const { services } = props;
  return (
    <TableBody>
      {services.map((service, index) => (
        <Row key={index} row={service} />
      ))}
    </TableBody>
  );
}

