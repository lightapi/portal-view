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
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
});

function Row(props) {
  const { row } = props;
  const classes = useRowStyles();

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this product version config property?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "product",
        action: "deleteProductVersionConfigProperty",
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

  return (
    <TableRow
      className={classes.root}
      key={`${row.hostId}-${row.productVersionId}-${row.propertyId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.productVersionId}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.propertyId}</TableCell>
      <TableCell align="left">{row.propertyName}</TableCell>
      <TableCell align="left">{row.updateUser}</TableCell>
      <TableCell align="left">
        {row.updateTs ? new Date(row.updateTs).toLocaleString() : ""}
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
    productVersionId: PropTypes.string.isRequired,
    productId: PropTypes.string.isRequired,
    productVersion: PropTypes.string.isRequired,
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string.isRequired,
    propertyId: PropTypes.string.isRequired,
    propertyName: PropTypes.string.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ProductVersionPropertyList(props) {
  const { productVersionProperties } = props;
  return (
    <TableBody>
      {productVersionProperties && productVersionProperties.length > 0 ? (
        productVersionProperties.map((productVersionProperty, index) => (
          <Row key={index} row={productVersionProperty} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No product version properties found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ProductVersionPropertyList.propTypes = {
  productVersionProperties: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ProductConfig() {
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
  const [configId, setConfigId] = useState("");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState("");
  const debouncedConfigName = useDebounce(configName, 1000);
  const [propertyId, setPropertyId] = useState("");
  const debouncedPropertyId = useDebounce(propertyId, 1000);
  const [propertyName, setPropertyName] = useState("");
  const debouncedPropertyName = useDebounce(propertyName, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [productVersionProperties, setProductVersionProperties] = useState([]);

  const handleProductVersionIdChange = (event) => {
    setProductVersionId(event.target.value);
  };
  const handleProductIdChange = (event) => {
    setProductId(event.target.value);
  };
  const handleProductVersionChange = (event) => {
    setProductVersion(event.target.value);
  };
  const handleConfigIdChange = (event) => {
    setConfigId(event.target.value);
  };
  const handleConfigNameChange = (event) => {
    setConfigName(event.target.value);
  };
  const handlePropertyIdChange = (event) => {
    setPropertyId(event.target.value);
  };
  const handlePropertyNameChange = (event) => {
    setPropertyName(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProductVersionProperties([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProductVersionProperties(data.productProperties);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setProductVersionProperties([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "product",
      action: "getProductVersionConfigProperty",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        productVersionId: debouncedProductVersionId,
        productId: debouncedProductId,
        productVersion: debouncedProductVersion,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        propertyId: debouncedPropertyId,
        propertyName: debouncedPropertyName,
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
    debouncedConfigId,
    debouncedConfigName,
    debouncedPropertyId,
    debouncedPropertyName,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (productVersionId, productId, productVersion) => {
    navigate("/app/form/createProductVersionConfigProperty", {
      state: { data: { productVersionId, productId, productVersion } },
    });
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
                    placeholder="Config Id"
                    value={configId}
                    onChange={handleConfigIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Config Name"
                    value={configName}
                    onChange={handleConfigNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Id"
                    value={propertyId}
                    onChange={handlePropertyIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Name"
                    value={propertyName}
                    onChange={handlePropertyNameChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ProductVersionPropertyList
              productVersionProperties={productVersionProperties}
            />
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
        <AddBoxIcon
          onClick={() =>
            handleCreate(productVersionId, productId, productVersion)
          }
        />
      </div>
    );
  }

  return <div className="ProductVersionProperty">{content}</div>;
}
