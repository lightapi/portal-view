import Button from '@mui/material/Button';
import { Box } from '@mui/material';
import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

export default function CityRegistry() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskContext = useMemo(
    () => mergeTaskContext(contextFromSearchParams(searchParams), { contentType: 'city' }),
    [searchParams],
  );
  const error = location.state?.error;

  const createCityMap = () => {
    navigate(buildTaskAwareRoute('/app/form/createCityMap', searchParams, taskContext));
  };

  return (
    <Box>
      <Widget
        title="City Map"
        upperTitle
        sx={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{
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
        <Box sx={{ '& > *': { m: 1 } }}>
          <Button variant="contained" color="primary" onClick={createCityMap}>
            Create
          </Button>
        </Box>
        <Box component="pre" sx={{ overflow: 'auto', mt: 2 }}>
          {JSON.stringify(error, null, 2)}
        </Box>
      </Widget>
    </Box>
  );
}
