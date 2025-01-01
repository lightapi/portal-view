import { useNavigate, useLocation } from "react-router-dom";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import ImageAspectRatioIcon from "@mui/icons-material/ImageAspectRatio";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import InputIcon from "@mui/icons-material/Input";
import SettingsIcon from "@mui/icons-material/Settings";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useApiGet } from "../../hooks/useApiGet";
import Widget from "../../components/Widget/Widget";
import useStyles from "./styles";

import CircularProgress from "@mui/material/CircularProgress";

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

  const handleSpecEdit = (serviceVersion) => {
    switch (serviceVersion.apiType) {
      case "openapi":
        navigate("/app/openapiEditor", {
          state: { data: { serviceVersion } },
        });
        break;
      case "hybrid":
        navigate("/app/hybridEditor", {
          state: { data: { serviceVersion } },
        });
        break;
      case "graphql":
        navigate("/app/graphqlEditor", {
          state: { data: { serviceVersion } },
        });
        break;
    }
  };

  const handleEndpoint = (hostId, apiId, apiVersion) => {
    navigate("/app/serviceEndpoint", {
      state: { data: { hostId, apiId, apiVersion } },
    });
  };

  const handleCodegen = (hostId, apiId) => {
    navigate("/app/serviceCodegen", { state: { data: { hostId, apiId } } });
  };

  const handleDeploy = (hostId, apiId) => {
    navigate("/app/serviceDeploy", { state: { data: { hostId, apiId } } });
  };

  const handleTest = (hostId, apiId) => {
    navigate("/app/serviceTest", { state: { data: { hostId, apiId } } });
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
      <div>
        <Widget
          title="Service Detail"
          upperTitle
          bodyClass={classes.fullHeightBody}
          className={classes.card}
        >
          <TableContainer component={Paper}>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Host ID</TableCell>
                  <TableCell>{service.hostId}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API ID</TableCell>
                  <TableCell>{service.apiId}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Service ID</TableCell>
                  <TableCell>{service.serviceId}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API Name</TableCell>
                  <TableCell>{service.apiName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API Description</TableCell>
                  <TableCell>{service.apiDesc}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Operation Owner</TableCell>
                  <TableCell>{service.operationOwner}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Delivery Owner</TableCell>
                  <TableCell>{service.deliveryOwner}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>{service.region}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Business Group</TableCell>
                  <TableCell>{service.businessGroup}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>LOB</TableCell>
                  <TableCell>{service.lob}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Platform</TableCell>
                  <TableCell>{service.platform}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Capability</TableCell>
                  <TableCell>{service.capability}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Git Repo</TableCell>
                  <TableCell>{service.gitRepo}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API Tags</TableCell>
                  <TableCell>{service.apiTags}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>API Status</TableCell>
                  <TableCell>{service.apiStatus}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Widget>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="left">Host Id</TableCell>
                <TableCell align="left">Api Id</TableCell>
                <TableCell align="left">Api Version</TableCell>
                <TableCell align="left">Api Type</TableCell>
                <TableCell align="left">Service Id</TableCell>
                <TableCell align="left">Api Version Desc</TableCell>
                <TableCell align="left">Spec Link</TableCell>
                <TableCell align="left">Spec Edit</TableCell>
                <TableCell align="right">Endpoint</TableCell>
                <TableCell align="right">Codegen</TableCell>
                <TableCell align="right">Deploy</TableCell>
                <TableCell align="right">Test</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data &&
                data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell align="left">{row.hostId}</TableCell>
                    <TableCell align="left">{row.apiId}</TableCell>
                    <TableCell align="left">{row.apiVersion}</TableCell>
                    <TableCell align="left">{row.apiType}</TableCell>
                    <TableCell align="left">{row.serviceId}</TableCell>
                    <TableCell align="left">{row.apiVersionDesc}</TableCell>
                    <TableCell align="left">{row.specLink}</TableCell>
                    <TableCell align="right">
                      <ImageAspectRatioIcon
                        onClick={() => handleSpecEdit(row)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <FormatListBulletedIcon
                        onClick={() =>
                          handleEndpoint(row.hostId, row.apiId, row.apiVersion)
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <InputIcon
                        onClick={() => handleCodegen(row.hostId, row.apiId)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <SettingsIcon
                        onClick={() => handleDeploy(row.hostId, row.apiId)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <BugReportIcon
                        onClick={() => handleTest(row.hostId, row.apiId)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    );
  }

  return <div className="App">{wait}</div>;
}
