import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import { useEffect, useState } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import ServiceList from "./ServiceList";
import useStyles from "./styles";

export default function Service(props) {
  const classes = useStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [apiId, setApiId] = useState("");
  const debouncedApiId = useDebounce(apiId, 1000);
  const [apiName, setApiName] = useState("");
  const debouncedApiName = useDebounce(apiName, 1000);
  const [apiType, setApiType] = useState("");
  const debouncedApiType = useDebounce(apiType, 1000);
  const [apiDesc, setApiDesc] = useState("");
  const debouncedApiDesc = useDebounce(apiDesc, 1000);
  const [operationOwner, setOperationOwner] = useState("");
  const debouncedOperationOwner = useDebounce(operationOwner, 1000);
  const [deliveryOwner, setDeliveryOwner] = useState("");
  const debouncedDeliveryOwner = useDebounce(deliveryOwner, 1000);
  const [region, setRegion] = useState("");
  const debouncedRegion = useDebounce(region, 1000);
  const [businessGroup, setBusinessGroup] = useState("");
  const debouncedBusinessGroup = useDebounce(businessGroup, 1000);
  const [lob, setLob] = useState("");
  const debouncedLob = useDebounce(lob, 1000);
  const [platform, setPlatform] = useState("");
  const debouncedPlatform = useDebounce(platform, 1000);
  const [capability, setCapability] = useState("");
  const debouncedCapability = useDebounce(capability, 1000);
  const [gitRepo, setGitRepo] = useState("");
  const debouncedGitRepo = useDebounce(gitRepo, 1000);
  const [apiTags, setApiTags] = useState("");
  const debouncedApiTags = useDebounce(apiTags, 1000);
  const [apiStatus, setApiStatus] = useState("");
  const debouncedApiStatus = useDebounce(apiStatus, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [services, setServices] = useState([]);

  const handleApiIdChange = (event) => {
    setApiId(event.target.value);
  };
  const handleApiNameChange = (event) => {
    setApiName(event.target.value);
  };
  const handleApiTypeChange = (event) => {
    setApiType(event.target.value);
  };
  const handleApiDescChange = (event) => {
    setApiDesc(event.target.value);
  };
  const handleOperationOwnerChange = (event) => {
    setOperationOwner(event.target.value);
  };
  const handleDeliveryOwnerChange = (event) => {
    setDeliveryOwner(event.target.value);
  };
  const handleRegionChange = (event) => {
    setRegion(event.target.value);
  };
  const handleBusinessGroupChange = (event) => {
    setBusinessGroup(event.target.value);
  };
  const handleLobChange = (event) => {
    setLob(event.target.value);
  };
  const handlePlatformChange = (event) => {
    setPlatform(event.target.value);
  };
  const handleCapabilityChange = (event) => {
    setCapability(event.target.value);
  };
  const handleGitRepoChange = (event) => {
    setGitRepo(event.target.value);
  };
  const handleApiTagsChange = (event) => {
    setApiTags(event.target.value);
  };
  const handleApiStatusChange = (event) => {
    setApiStatus(event.target.value);
  };

  const cmd = {
    host: "lightapi.net",
    service: "market",
    action: "getService",
    version: "0.1.0",
    data: {
      hostId: host,
      offset: page * rowsPerPage,
      limit: rowsPerPage,
      apiId: debouncedApiId,
      apiName: debouncedApiName,
      apiType: debouncedApiType,
      apiDesc: debouncedApiDesc,
      operationOwner: debouncedOperationOwner,
      deliveryOwner: debouncedDeliveryOwner,
      region: debouncedRegion,
      businessGroup: debouncedBusinessGroup,
      lob: debouncedLob,
      platform: debouncedPlatform,
      capability: debouncedCapability,
      gitRepo: debouncedGitRepo,
      apiTags: debouncedApiTags,
      apiStatus: debouncedApiStatus,
    },
  };
  console.log("cmd = ", cmd);
  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const fetchData = async (url, headers) => {
    try {
      setLoading(true);
      console.log("fetch data from API with cmd = ", cmd);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setServices([]);
      } else {
        const data = await response.json();
        setServices(data.services);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    fetchData(url, headers);
  }, [
    url,
    fetchData,
    page,
    rowsPerPage,
    debouncedApiId,
    debouncedApiName,
    debouncedApiType,
    debouncedApiDesc,
    debouncedOperationOwner,
    debouncedDeliveryOwner,
    debouncedRegion,
    debouncedBusinessGroup,
    debouncedLob,
    debouncedPlatform,
    debouncedCapability,
    debouncedGitRepo,
    debouncedApiTags,
    debouncedApiStatus,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createService");
  };

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
  } else {
    wait = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Id"
                    value={apiId}
                    onChange={handleApiIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Name"
                    value={apiName}
                    onChange={handleApiNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Type"
                    value={apiType}
                    onChange={handleApiTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Desc"
                    value={apiDesc}
                    onChange={handleApiDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Ops Owner"
                    value={operationOwner}
                    onChange={handleOperationOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Dly Owner"
                    value={deliveryOwner}
                    onChange={handleDeliveryOwnerChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Region"
                    value={region}
                    onChange={handleRegionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Biz Group"
                    value={businessGroup}
                    onChange={handleBusinessGroupChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Lob"
                    value={lob}
                    onChange={handleLobChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Platform"
                    value={platform}
                    onChange={handlePlatformChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Capability"
                    value={capability}
                    onChange={handleCapabilityChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Git Repo"
                    value={gitRepo}
                    onChange={handleGitRepoChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Tags"
                    value={apiTags}
                    onChange={handleApiTagsChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Status"
                    value={apiStatus}
                    onChange={handleApiStatusChange}
                  />
                </TableCell>
                <TableCell align="right">Detail</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ServiceList {...props} services={services} />
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
        <AddBoxIcon onClick={() => handleCreate()} />
      </div>
    );
  }

  return <div className="App">{wait}</div>;
}
