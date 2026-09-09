import PortalActionIcon from '@mui/icons-material/ArrowForward';
import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';

import { Box } from '@mui/material';
import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromObject, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

export default function CityProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const data = location.state?.data;
  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      contextFromObject(data),
      { contentType: 'city' },
    ),
    [data, searchParams],
  );

  const updateCityMap = () => {
    navigate(buildTaskAwareRoute('/app/form/updateCityMap', searchParams, taskContext), {
      state: { data },
    });
  };

  const deleteCityMap = () => {
    if (window.confirm('Are you sure you want to delete the city?')) {
      navigate('/app/covid/deleteCity', {
        state: { data },
      });
    }
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
          <PortalActionScope><PortalActions row={null} actions={[
            {
              id: "update",
              label: "Update",
              icon: <PortalActionIcon />,
              onSelect: updateCityMap
            },
            {
              id: "delete",
              label: "Delete",
              icon: <PortalActionIcon />,
              destructive: true,
              onSelect: deleteCityMap
            }
          ]} /></PortalActionScope>

        </Box>
        <Box component="pre" sx={{ overflow: 'auto', mt: 2 }}>
          {JSON.stringify(data, null, 2)}
        </Box>
      </Widget>
    </Box>
  );
}
