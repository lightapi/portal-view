import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';
import { DataGrid, useGridApiContext, useGridState } from '@mui/x-data-grid';
import React, { useEffect } from 'react';
import Cookies from 'universal-cookie';
import ConfigEditModal from '../../components/Modal/Config/ConfigEditModal';
import { Typography } from '../../components/Wrappers/Wrappers';
import { useUserDispatch, useUserState } from '../../contexts/UserContext';
import useStyles from './styles';

export default function ServiceConfig(props) {
  var classes = useStyles();
  /*
  // can not remember why we need to query user profile here
  const { email } = useUserState();
  const userDispatch = useUserDispatch();
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'queryUserByEmail',
    version: '0.1.0',
    data: { email },
  };
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const cookies = new Cookies();
        Object.assign(headers, { 'X-CSRF-TOKEN': cookies.get('csrf') });
        const response = await fetch(url, {
          headers,
          credentials: 'include',
          signal: abortController.signal,
        });
        //console.log(response);
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        //console.log(data);
        userDispatch({
          type: 'UPDATE_PROFILE',
          userId: data.userId,
          host: data.host,
        });
      } catch (e) {
        // only call dispatch when we know the fetch was not aborted
        if (!abortController.signal.aborted) {
          // const error = await e.json();
          console.log(e);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

  console.log('In Dashboard.js 000 classes.mainHeader: ', classes.mainHeader);
  */
  const columns = [
    // { field: 'id', headerName: 'ID', width: 90 },
    {
      field: 'moduleName',
      headerName: 'Module Name',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellClassName: 'super-app-theme--cell',
    },
    {
      field: 'projectName',
      headerName: 'Project Name',
      flex: 1,
      minWidth: 150,
      editable: true,
    },
    {
      field: 'projectVersion',
      headerName: 'Project Version',
      type: 'number',
      flex: 1,
      minWidth: 100,
      editable: true,
    },
    {
      field: 'serviceName',
      headerName: 'Service Name',
      description: 'Service Name',
      flex: 1,
      minWidth: 150,
      sortable: false,
    },
    {
      field: 'serviceVersion',
      headerName: 'Service Version',
      description: 'Service Version',
      flex: 1,
      minWidth: 150,
      sortable: false,
    },
    // Action column
    {
      field: 'action',
      headerName: 'Action',
      flex: 1,
      minWidth: 150,
      sortable: false,
      disableColumnMenu: true,
      headerAlign: 'center',
      renderCell: (params) => {
        const onEdit = (e) => {
          e.stopPropagation();
          const api = params.api;
          const thisRow = { Action: 'Edit' };
          api
            .getAllColumns()
            .filter((c) => c.field !== '__check__' && !!c)
            .forEach(
              (c) => (thisRow[c.field] = params.getValue(params.id, c.field))
            );
          // alert(JSON.stringify(thisRow, null, 4));
          handleOpen();
        };

        const onDelete = (e) => {
          e.stopPropagation();
          const api = params.api;
          const thisRow = { Action: 'Delete' };
          api
            .getAllColumns()
            .filter((c) => c.field !== '__check__' && !!c)
            .forEach(
              (c) => (thisRow[c.field] = params.getValue(params.id, c.field))
            );

          return alert(JSON.stringify(thisRow, null, 4));
        };

        return (
          <span
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-around',
            }}
          >
            <Button
              variant="contained"
              size="small"
              onClick={onEdit}
              className={classes.actionButton}
            >
              Edit
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={onDelete}
              className={classes.actionButton}
            >
              Delete
            </Button>
          </span>
        );
      },
    },
  ];

  const rows = [
    {
      id: 1,
      projectName: 'project 1',
      moduleName: 'module name 1',
      projectVersion: 1001,
      serviceName: 'Service 1',
      serviceVersion: '1.0.1',
    },
    {
      id: 2,
      projectName: 'project 2',
      moduleName: 'module name 2',
      projectVersion: 1002,
      serviceName: 'Service 2',
      serviceVersion: '1.0.1',
    },
    {
      id: 3,
      projectName: 'project 3',
      moduleName: 'module name 3',
      projectVersion: 1003,
      serviceName: 'Service 3',
      serviceVersion: '1.0.1',
    },
    {
      id: 4,
      projectName: 'project 4',
      moduleName: 'module name 4',
      projectVersion: 1004,
      serviceName: 'Service 4',
      serviceVersion: '1.0.1',
    },
    {
      id: 5,
      projectName: 'project 5',
      moduleName: 'module name 5',
      projectVersion: 1005,
      serviceName: 'Service 5',
      serviceVersion: '1.0.1',
    },
    {
      id: 6,
      projectName: 'project 6',
      moduleName: 'module name 6',
      projectVersion: 1006,
      serviceName: 'Service 6',
      serviceVersion: '1.0.1',
    },
    {
      id: 7,
      projectName: 'project 7',
      moduleName: 'module name 7',
      projectVersion: 1007,
      serviceName: 'Service 7',
      serviceVersion: '1.0.1',
    },
    {
      id: 8,
      projectName: 'project 8',
      moduleName: 'module name 8',
      projectVersion: 1008,
      serviceName: 'Service 8',
      serviceVersion: '1.0.1',
    },
    {
      id: 9,
      projectName: 'project 9',
      moduleName: 'module name 9',
      projectVersion: 1009,
      serviceName: 'Service 9',
      serviceVersion: '1.0.1',
    },
  ];

  function CustomPagination() {
    const apiRef = useGridApiContext();
    const [state] = useGridState(apiRef);

    return (
      <Pagination
        color="primary"
        variant="outlined"
        shape="rounded"
        page={state.pagination.page + 1}
        count={state.pagination.pageCount}
        // @ts-expect-error
        renderItem={(props2) => <PaginationItem {...props2} disableRipple />}
        onChange={(event, value) => apiRef.current.setPage(value - 1)}
      />
    );
  }

  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div>
      <Box className={classes.mainHeader}>
        <Typography className={classes.mainTitle}>Config Server</Typography>
      </Box>
      <Box className={classes.dataGridContainer}>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5]}
            checkboxSelection={false}
            disableSelectionOnClick
            className={classes.root}
            components={{
              Pagination: CustomPagination,
            }}
          />
        </div>
      </Box>

      <ConfigEditModal open={open} onClose={handleClose}></ConfigEditModal>
    </div>
  );
}
