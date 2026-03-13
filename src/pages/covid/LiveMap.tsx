import Button from '@mui/material/Button';
import { Box } from '@mui/material';
import React, { useRef, useState } from 'react';
import ReactMapGL, { Marker, Popup } from 'react-map-gl';
import { useLocation, useNavigate } from 'react-router-dom';
import useSupercluster from 'use-supercluster';

// Define your own FlyToInterpolator component
const FlyToInterpolator = (props: any) => {
  const { duration = 2000 } = props;

  return {
    step: (frame: any) => {
      const t = frame.t / duration;
      return {
        longitude: props.longitude * (1 - t) + frame.longitude * t,
        latitude: props.latitude * (1 - t) + frame.latitude * t,
        zoom: props.zoom * (1 - t) + frame.zoom * t,
      };
    },
  };
};

export default function LiveMap() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state?.data;
  
  const [viewport, setViewport] = useState({
    latitude: data?.map?.latitude || 0,
    longitude: data?.map?.longitude || 0,
    width: '100vw',
    height: '100vh',
    zoom: data?.map?.zoom || 1,
  });
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const mapRef = useRef<any>(null);
  const points = data?.points || [];

  const bounds = mapRef.current
    ? mapRef.current.getMap().getBounds().toArray().flat()
    : null;

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom: viewport.zoom,
    options: { radius: 75, maxZoom: 20 },
  });

  const ICON = `M20.2,15.7L20.2,15.7c1.1-1.6,1.8-3.6,1.8-5.7c0-5.6-4.5-10-10-10S2,4.5,2,10c0,2,0.6,3.9,1.6,5.4c0,0.1,0.1,0.2,0.2,0.3
  c0,0,0.1,0.1,0.1,0.2c0.2,0.3,0.4,0.6,0.7,0.9c2.6,3.1,7.4,7.6,7.4,7.6s4.8-4.5,7.4-7.5c0.2-0.3,0.5-0.6,0.7-0.9
  C20.1,15.8,20.2,15.8,20.2,15.7z`;

  const SIZE = 20;

  const pm = (id: string) => {
    navigate('/app/form/privateMessage', {
      state: { data: { userId: id } },
    });
  };

  const ps = (id: string) => {
    navigate('/app/covid/peerStatus', {
      state: { data: { userId: id } },
    });
  };

  const site = (id: string) => {
    navigate('/app/website', {
      state: { data: { userId: id } },
    });
  };

  return (
    <Box>
      <ReactMapGL
        {...viewport}
        maxZoom={25}
        mapboxAccessToken={(import.meta as any).env.VITE_APP_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        onMove={(evt: any) => {
          setViewport(evt.viewState);
        }}
        ref={mapRef}
      >
        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } =
            cluster.properties;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                latitude={latitude}
                longitude={longitude}
              >
                <Box
                  onClick={() => {
                    const expansionZoom = Math.min(
                      supercluster?.getClusterExpansionZoom(cluster.id as number) ?? 20,
                      20
                    );

                    setViewport({
                      ...viewport,
                      latitude,
                      longitude,
                      zoom: expansionZoom,
                      // @ts-ignore
                      transitionInterpolator: new FlyToInterpolator({
                        duration: 2000,
                        longitude,
                        latitude,
                        zoom: viewport.zoom
                      }),
                      transitionDuration: 'auto',
                    });
                  }}
                  sx={{
                    color: '#fff',
                    background: '#1978c8',
                    borderRadius: '50%',
                    padding: '10px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    width: `${10 + (pointCount! / points.length) * 20}px`,
                    height: `${10 + (pointCount! / points.length) * 20}px`,
                  }}
                >
                  {pointCount}
                </Box>
              </Marker>
            );
          }

          return (
            <Marker
              key={`marker-${cluster.properties.id}`}
              latitude={latitude}
              longitude={longitude}
            >
              <svg
                height={SIZE}
                viewBox="0 0 24 24"
                style={{
                  cursor: 'pointer',
                  fill: '#d00',
                  stroke: 'none',
                  transform: `translate(${-SIZE / 2}px,${-SIZE}px)`,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedEntity(cluster);
                }}
              >
                <path d={ICON} />
              </svg>
            </Marker>
          );
        })}
        {selectedEntity ? (
          <Popup
            latitude={selectedEntity.geometry.coordinates[1]}
            longitude={selectedEntity.geometry.coordinates[0]}
            closeButton={true}
            closeOnClick={false}
            onClose={() => {
              setSelectedEntity(null);
            }}
          >
            <Box>
              <Box component="h2">
                {selectedEntity.properties.id} -{' '}
                {selectedEntity.properties.category} -{' '}
                {selectedEntity.properties.subcategory}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => pm(selectedEntity.properties.id)}
                >
                  Private Message
                </Button>
                {selectedEntity.properties.hasStatus ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => ps(selectedEntity.properties.id)}
                  >
                    Peer Status
                  </Button>
                ) : null}
                {selectedEntity.properties.hasWebsite ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => site(selectedEntity.properties.id)}
                  >
                    Peer Site
                  </Button>
                ) : null}
              </Box>
              <Box component="p" sx={{ mt: 1 }}>{selectedEntity.properties.introduction}</Box>
            </Box>
          </Popup>
        ) : null}
      </ReactMapGL>
    </Box>
  );
}
