import { useNavigate, useLocation } from "react-router-dom";
import { useApiGet } from "../../hooks/useApiGet";
import Widget from "../../components/Widget/Widget";
import useStyles from "./styles";

import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";

export default function ServiceDetail() {
  const classes = useStyles();
  const location = useLocation();
  console.log("location =", location);
  const navigate = useNavigate();
  const { service } = location.state;
  const { hostId, apiId, apiType } = service;
  console.log(hostId, apiId, apiType);

  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getServiceVersion",
    version: "0.1.0",
    data: { hostId, apiId },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  console.log(url);
  const headers = {};

  const { isLoading, data } = useApiGet({ url, headers });

  const uploadSpec = () => {
    navigate("/app/uploadSpec", { state: { data } });
  };

  const listEndpoint = () => {
    navigate("/app/listEndpoint", { state: { data } });
  };

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <Widget
        title="Service Detail"
        upperTitle
        bodyClass={classes.fullHeightBody}
        className={classes.card}
      >
        <div className={classes.button}>
          <Button variant="contained" color="primary" onClick={uploadSpec}>
            Upload Spec
          </Button>
          <Button variant="contained" color="primary" onClick={listEndpoint}>
            List Endpoint
          </Button>
        </div>
        <pre>{service ? JSON.stringify(service, null, 2) : "Unauthorized"}</pre>
        <pre>{data ? JSON.stringify(data, null, 2) : "Unauthorized"}</pre>
      </Widget>
    );
  }

  return <div className="App">{wait}</div>;
}
