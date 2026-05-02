import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import Widget from '../../components/Widget/Widget';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromObject, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

export default function EntityProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { email, userId } = useUserState();
  
  const cmd = {
    host: 'lightapi.net',
    service: 'covid',
    action: 'getEntity',
    version: '0.1.0',
    data: { email },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data, error } = useApiGet({ url, headers });
  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      contextFromObject(data),
      { userId: userId ?? '', contentType: 'entity' },
    ),
    [data, searchParams, userId],
  );

  const deleteEntity = () => {
    if (window.confirm('Are you sure you want to delete the entity?')) {
      navigate('/app/covid/deleteEntity', {
        state: { data },
      });
    }
  };

  const updateEntity = () => {
    if (
      window.confirm(
        'Updating category and subcategory will remove the Website and Status.'
      )
    ) {
      navigate(buildTaskAwareRoute('/app/form/updateCovidEntity', searchParams, taskContext), {
        state: { data },
      });
    }
  };

  const createEntity = () => {
    navigate(buildTaskAwareRoute('/app/form/createCovidEntity', searchParams, taskContext));
  };

  const buttonSx = {
    '& > button': {
      m: 1,
    },
  };

  let buttons;
  if (data) {
    buttons = (
      <Box sx={buttonSx}>
        <Button variant="contained" color="primary" onClick={updateEntity}>
          Update
        </Button>
        <Button variant="contained" color="primary" onClick={deleteEntity}>
          Delete
        </Button>
      </Box>
    );
  } else {
    buttons = (
      <Box sx={buttonSx}>
        <Button variant="contained" color="primary" onClick={createEntity}>
          Create
        </Button>
      </Box>
    );
  }

  let wait;
  if (isLoading) {
    wait = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else {
    wait = (
      <Widget
        title="Entity Profile"
        upperTitle
        sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
        bodySx={{
          display: 'flex',
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ mb: 2 }}>
          <TaskActionPanel
            title="Community Content Tasks"
            context={taskContext}
            taskIds={['manage-community-content']}
            maxActions={1}
          />
        </Box>
        {buttons}
        <Box component="pre" sx={{ overflowX: 'auto', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          {data ? JSON.stringify(data, null, 2) : error}
        </Box>
      </Widget>
    );
  }

  return <Box className="App">{wait}</Box>;
}
