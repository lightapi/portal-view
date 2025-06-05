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
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import LanguageIcon from "@mui/icons-material/Language";
import GridGoldenratioIcon from "@mui/icons-material/GridGoldenratio";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";
import { stringToBoolean } from "../../utils/index.jsx";

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
    });
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
        window.location.reload();
      } else if (result.error) {
        console.error("Api Error", result.error);
      }
    }
  };

  const handleConfig = (productVersionId) => {
    navigate("/app/config/configProductVersion", {
      state: { data: { productVersionId } },
    });
  };

  const handleEnvironment = (productVersionId, productId, productVersion) => {
    navigate("/app/product/environment", {
      state: { data: { productVersionId, productId, productVersion } },
    });
  };

  const handlePipeline = (productVersionId, productId, productVersion) => {
    navigate("/app/product/pipeline", {
      state: { data: { productVersionId, productId, productVersion } },
    });
  };

  const handleProductConfig = (productVersionId, productId, productVersion) => {
    navigate("/app/product/config", {
      state: { data: { productVersionId, productId, productVersion } },
    });
  };

  const handleProductProperty = (
    productVersionId,
    productId,
    productVersion,
  ) => {
    navigate("/app/product/property", {
      state: { data: { productVersionId, productId, productVersion } },
    });
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.productVersionId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.productVersionId}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.light4jVersion}</TableCell>
      <TableCell align="left">{row.breakCode ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.breakConfig ? "Yes" : "No"}</TableCell>
      <TableCell align="left">{row.releaseNote}</TableCell>
      <TableCell align="left">{row.versionDesc}</TableCell>
      <TableCell align="left">{row.releaseType}</TableCell>
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
      <TableCell align="right">
        <AddToDriveIcon onClick={() => handleConfig(row.productVersionId)} />
      </TableCell>
      <TableCell align="right">
        <LanguageIcon
          onClick={() =>
            handleEnvironment(
              row.productVersionId,
              row.productId,
              row.productVersion,
            )
          }
        />
      </TableCell>
      <TableCell align="right">
        <GridGoldenratioIcon
          onClick={() =>
            handlePipeline(
              row.productVersionId,
              row.productId,
              row.productVersion,
            )
          }
        />
      </TableCell>
      <TableCell align="right">
        <GridGoldenratioIcon
          onClick={() =>
            handleProductConfig(
              row.productVersionId,
              row.productId,
              row.productVersion,
            )
          }
        />
      </TableCell>
      <TableCell align="right">
        <GridGoldenratioIcon
          onClick={() =>
            handleProductProperty(
              row.productVersionId,
              row.productId,
              row.productVersion,
            )
          }
        />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    productVersionId: PropTypes.string.isRequired,
    productId: PropTypes.string.isRequired,
    productVersion: PropTypes.string.isRequired,
    light4jVersion: PropTypes.string,
    breakCode: PropTypes.bool,
    breakConfig: PropTypes.bool,
    releaseNote: PropTypes.string,
    versionDesc: PropTypes.string,
    releaseType: PropTypes.string,
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
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [productVersionId, setProductVersionId] = useState(
    () => data?.productVersionId || "",
  );
  const debouncedProductVersionId = useDebounce(productVersionId, 1000);
  const [productId, setProductId] = useState(() => data?.productId || "");
  const debouncedProductId = useDebounce(productId, 1000);
  const [productVersion, setProductVersion] = useState(
    () => data?.productVersion || "",
  );
  const debouncedProductVersion = useDebounce(productVersion, 1000);
  const [light4jVersion, setLight4jVersion] = useState("");
  const debouncedLight4jVersion = useDebounce(light4jVersion, 1000);
  const [breakCode, setBreakCode] = useState("");
  const debouncedBreakCode = useDebounce(breakCode, 1000);
  const [breakConfig, setBreakConfig] = useState("");
  const debouncedBreakConfig = useDebounce(breakConfig, 1000);
  const [releaseNote, setReleaseNote] = useState("");
  const debouncedReleaseNote = useDebounce(releaseNote, 1000);
  const [releaseType, setReleaseType] = useState("");
  const debouncedReleaseType = useDebounce(releaseType, 1000);
  const [versionStatus, setVersionStatus] = useState("");
  const debouncedVersionStatus = useDebounce(versionStatus, 1000);
  const [versionDesc, setVersionDesc] = useState("");
  const debouncedVersionDesc = useDebounce(versionDesc, 1000);
  const [current, setCurrent] = useState("");
  const debouncedCurrent = useDebounce(current, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [productVersions, setProductVersions] = useState([]);

  const handleProductVersionIdChange = (event) => {
    setProductVersionId(event.target.value);
  };
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
    setBreakCode(event.target.value);
  };
  const handleBreakConfigChange = (event) => {
    setBreakConfig(event.target.value);
  };
  const handleReleaseNoteChange = (event) => {
    setReleaseNote(event.target.value);
  };
  const handleReleaseTypeChange = (event) => {
    setReleaseType(event.target.value);
  };
  const handleVersionStatusChange = (event) => {
    setVersionStatus(event.target.value);
  };
  const handleVersionDescChange = (event) => {
    setVersionDesc(event.target.value);
  };
  const handleCurrentChange = (event) => {
    setCurrent(event.target.value);
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
        productVersionId: debouncedProductVersionId,
        productId: debouncedProductId,
        productVersion: debouncedProductVersion,
        light4jVersion: debouncedLight4jVersion,
        releaseNote: debouncedReleaseNote,
        releaseType: debouncedReleaseType,
        versionStatus: debouncedVersionStatus,
        versionDesc: debouncedVersionDesc,
        ...(debouncedCurrent && debouncedCurrent.trim() !== ""
          ? { current: stringToBoolean(debouncedCurrent) }
          : {}),
        ...(debouncedBreakCode && debouncedBreakCode.trim() !== ""
          ? { breakCode: stringToBoolean(debouncedBreakCode) }
          : {}),
        ...(debouncedBreakConfig && debouncedBreakConfig.trim() !== ""
          ? { breakConfig: stringToBoolean(debouncedBreakConfig) }
          : {}),
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
    debouncedProductVersionId,
    debouncedProductId,
    debouncedProductVersion,
    debouncedLight4jVersion,
    debouncedBreakCode,
    debouncedBreakConfig,
    debouncedReleaseNote,
    debouncedReleaseType,
    debouncedVersionStatus,
    debouncedVersionDesc,
    debouncedCurrent,
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
                    placeholder="Product Version Id"
                    value={productVersionId}
                    onChange={handleProductVersionIdChange}
                  />
                </TableCell>
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
                  <input
                    type="text"
                    placeholder="Break Code"
                    value={breakCode}
                    onChange={handleBreakCodeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Break Config"
                    value={breakConfig}
                    onChange={handleBreakConfigChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Release Note"
                    value={releaseNote}
                    onChange={handleReleaseNoteChange}
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
                  <input
                    type="text"
                    placeholder="Release Type"
                    value={releaseType}
                    onChange={handleReleaseTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Current"
                    value={current}
                    onChange={handleCurrentChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Version Status"
                    value={versionStatus}
                    onChange={handleVersionStatusChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Config</TableCell>
                <TableCell align="right">Environment</TableCell>
                <TableCell align="right">Pipeline</TableCell>
                <TableCell align="right">Product Config</TableCell>
                <TableCell align="right">Product Property</TableCell>
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
