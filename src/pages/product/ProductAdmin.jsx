import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import FormControlLabel from "@mui/material/FormControlLabel";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
} from "@mui/material";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const navigate = useNavigate();
  const { row } = props;
  const classes = useRowStyles();

  const handleUpdate = (productVersion) => {
    navigate("/app/form/updateProductVersion", {
      state: { data: { ...productVersion } },
    }); // Adjust path as needed
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete this product version?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "product",
        action: "deleteProductVersion",
        version: "0.1.0",
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refresh the data after successful deletion
        window.location.reload();
      } else if (result.error) {
        console.error("Api Error", result.error);
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.productId}-${row.productVersion}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.light4jVersion}</TableCell>
      <TableCell align="left">{row.breakCode ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.breakConfig ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.upgradeGuide}</TableCell>
      <TableCell align="left">{row.versionDesc}</TableCell>
      <TableCell align="left">{row.current ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.versionStatus}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    productId: PropTypes.string.isRequired,
    productVersion: PropTypes.string.isRequired,
    light4jVersion: PropTypes.string,
    breakCode: PropTypes.bool,
    breakConfig: PropTypes.bool,
    upgradeGuide: PropTypes.string,
    versionDesc: PropTypes.string,
    current: PropTypes.bool,
    versionStatus: PropTypes.string.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ProductVersionList(props) {
  const { productVersions } = props;
  return (
    <TableBody>
      {productVersions && productVersions.length > 0 ? (
        productVersions.map((productVersion, index) => (
          <Row key={index} row={productVersion} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No product versions found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ProductVersionList.propTypes = {
  productVersions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ProductAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [productId, setProductId] = useState("");
  const debouncedProductId = useDebounce(productId, 1000);
  const [productVersion, setProductVersion] = useState("");
  const debouncedProductVersion = useDebounce(productVersion, 1000);
  const [light4jVersion, setLight4jVersion] = useState("");
  const debouncedLight4jVersion = useDebounce(light4jVersion, 1000);
  const [breakCode, setBreakCode] = useState(false);
  const [breakConfig, setBreakConfig] = useState(false);
  const [upgradeGuide, setUpgradeGuide] = useState("");
  const debouncedUpgradeGuide = useDebounce(upgradeGuide, 1000);
  const [versionStatus, setVersionStatus] = useState("");
  const debouncedVersionStatus = useDebounce(versionStatus, 1000);
  const [versionDesc, setVersionDesc] = useState("");
  const debouncedVersionDesc = useDebounce(versionDesc, 1000);
  const [currentFilter, setCurrentFilter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [productVersions, setProductVersions] = useState([]);

  const handleProductIdChange = (event) => {
    setProductId(event.target.value);
  };
  const handleProductVersionChange = (event) => {
    setProductVersion(event.target.value);
  };
  const handleLight4jVersionChange = (event) => {
    setLight4jVersion(event.target.value);
  };
  const handleBreakCodeChange = (event) => {
    setBreakCode(event.target.checked);
  };
  const handleBreakConfigChange = (event) => {
    setBreakConfig(event.target.checked);
  };
  const handleUpgradeGuideChange = (event) => {
    setUpgradeGuide(event.target.value);
  };
  const handleVersionStatusChange = (event) => {
    setVersionStatus(event.target.value);
  };
  const handleVersionDescChange = (event) => {
    setVersionDesc(event.target.value);
  };
  const handleCurrentFilterChange = (event) => {
    setCurrentFilter(event.target.checked);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProductVersions([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProductVersions(data.products);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setProductVersions([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "product",
      action: "getProductVersion",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        productId: debouncedProductId,
        productVersion: debouncedProductVersion,
        light4jVersion: debouncedLight4jVersion,
        breakCode: breakCode,
        breakConfig: breakConfig,
        upgradeGuide: debouncedUpgradeGuide,
        versionStatus: debouncedVersionStatus,
        versionDesc: debouncedVersionDesc,
        current: currentFilter || undefined, // Include current filter, send undefined if false
      },
    };

    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedProductId,
    debouncedProductVersion,
    debouncedLight4jVersion,
    breakCode,
    breakConfig,
    debouncedUpgradeGuide,
    debouncedVersionStatus,
    debouncedVersionDesc,
    currentFilter,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createProductVersion"); // Adjust path as needed
  };

  let content;
  if (loading) {
    content = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    content = (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="product version table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">Host ID</TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Product Id"
                    value={productId}
                    onChange={handleProductIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Product Version"
                    value={productVersion}
                    onChange={handleProductVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Light4j Version"
                    value={light4jVersion}
                    onChange={handleLight4jVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <FormControl component="fieldset" variant="standard">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={breakCode}
                          onChange={handleBreakCodeChange}
                          name="breakCode"
                        />
                      }
                      label="Break Code"
                    />
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <FormControl component="fieldset" variant="standard">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={breakConfig}
                          onChange={handleBreakConfigChange}
                          name="breakConfig"
                        />
                      }
                      label="Break Config"
                    />
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Upgrade Guide"
                    value={upgradeGuide}
                    onChange={handleUpgradeGuideChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Version Desc"
                    value={versionDesc}
                    onChange={handleVersionDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <FormControl component="fieldset" variant="standard">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={currentFilter}
                          onChange={handleCurrentFilterChange}
                          name="currentFilter"
                        />
                      }
                      label="Current"
                    />
                  </FormControl>
                </TableCell>
                <TableCell align="left">
                  <FormControl fullWidth variant="standard">
                    <InputLabel id="version-status-label">
                      Version Status
                    </InputLabel>
                    <Select
                      labelId="version-status-label"
                      id="version-status"
                      value={versionStatus}
                      onChange={handleVersionStatusChange}
                      label="Version Status"
                    >
                      <MenuItem value={""}> </MenuItem>
                      <MenuItem value={"Supported"}>Supported</MenuItem>
                      <MenuItem value={"Outdated"}>Outdated</MenuItem>
                      <MenuItem value={"Deprecated"}>Deprecated</MenuItem>
                      <MenuItem value={"Removed"}>Removed</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ProductVersionList productVersions={productVersions} />
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

  return <div className="ProductAdmin">{content}</div>;
}
