import Button from '@mui/material/Button';
import React, { useRef, useState } from 'react';
import ReactMapGL, { Marker, Popup } from 'react-map-gl';
import useSupercluster from 'use-supercluster';
import useStyles from './styles';

// Define your own FlyToInterpolator component
const FlyToInterpolator = (props) => {
  const { duration = 2000 } = props;

  return {
    step: (frame) => {
      const t = frame.t / duration;
      return {
        longitude: props.longitude * (1 - t) + frame.longitude * t,
        latitude: props.latitude * (1 - t) + frame.latitude * t,
        zoom: props.zoom * (1 - t) + frame.zoom * t,
      };
    },
  };
};

export default function LiveMap(props) {
  const classes = useStyles();
  //console.log("props = ", props);
  //console.log("data = ", props.location.state.data);
  const data = props.location.state.data;
  //console.log("latitude", data.map.latitude);
  //console.log("longitude", data.map.longitude);
  //console.log("zoom", data.map.zoom);

  const [viewport, setViewport] = useState({
    latitude: data.map.latitude,
    longitude: data.map.longitude,
    width: '100vw',
    height: '100vh',
    zoom: data.map.zoom,
  });
  const [selectedEntity, setSelectedEntity] = useState(null);

  //console.log("viewport", viewport);

  const mapRef = useRef();

  const points = data.points;

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

  const pm = (id) => {
    //console.log("private message is called", id);
    props.history.push({
      pathname: '/app/form/privateMessage',
      state: { data: { userId: id } },
    });
  };

  const ps = (id) => {
    //console.log("peer status is called", id);
    props.history.push({
      pathname: '/app/covid/peerStatus',
      state: { data: { userId: id } },
    });
  };

  const site = (id) => {
    //console.log("peer website is called", id);
    props.history.push({
      pathname: '/app/website',
      state: { data: { userId: id } },
    });
  };

  return (
    <div>
      <ReactMapGL
        {...viewport}
        maxZoom={25}
        mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        onViewportChange={(newViewport) => {
          setViewport({ ...newViewport });
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
                <div
                  className={classes.clusterMarker}
                  style={{
                    width: `${10 + (pointCount / points.length) * 20}px`,
                    height: `${10 + (pointCount / points.length) * 20}px`,
                  }}
                  onClick={() => {
                    const expansionZoom = Math.min(
                      supercluster.getClusterExpansionZoom(cluster.id),
                      20
                    );

                    setViewport({
                      ...viewport,
                      latitude,
                      longitude,
                      zoom: expansionZoom,
                      transitionInterpolator: new FlyToInterpolator({
                        duration: 2000,
                      }),
                      transitionDuration: 'auto',
                    });
                  }}
                >
                  {pointCount}
                </div>
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
            <div>
              <h2>
                {selectedEntity.properties.id} -{' '}
                {selectedEntity.properties.category} -{' '}
                {selectedEntity.properties.subcategory}
              </h2>
              <div className={classes.button}>
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
              </div>
              <p>{selectedEntity.properties.introduction}</p>
            </div>
          </Popup>
        ) : null}
      </ReactMapGL>
    </div>
  );
}
