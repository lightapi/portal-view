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
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js"; // Assuming this hook exists
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext.jsx"; // Assuming this context exists
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost.js"; // Assuming this apiPost function exists

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

  const handleUpdate = (configProduct) => {
    navigate("/app/form/updateConfigProduct", {
      state: { data: { ...configProduct } },
    }); // Adjust path as needed
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete this config product property?",
      )
    ) {
      const cmd = {
        host: "lightapi.net", // Adjust as needed
        service: "config", //  Adjust to your service name.
        action: "deleteConfigProduct", // Adjust to your action
        version: "0.1.0", //  Adjust
        data: row,
      };

      const result = await apiPost({
        url: "/portal/command", // Adjust if your command endpoint is different
        headers: {},
        body: cmd,
      });

      if (result.data) {
        window.location.reload(); // Consider state update instead of page reload
      } else if (result.error) {
        console.error("API Error:", result.error);
        //  Optionally show an error message to the user.
      }
    }
  };

  return (
    <TableRow
      className={classes.root}
      key={`${row.productId}-${row.configId}-${row.propertyName}`}
    >
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
      <TableCell align="left">{row.propertyId}</TableCell>
      <TableCell align="left">{row.propertyName}</TableCell>
      <TableCell align="left">{row.propertyValue}</TableCell>
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

Row.propTypes = {
  row: PropTypes.shape({
    productId: PropTypes.string.isRequired,
    configId: PropTypes.string.isRequired,
    configName: PropTypes.string.isRequired,
    propertyId: PropTypes.string.isRequired,
    propertyName: PropTypes.string.isRequired,
    propertyValue: PropTypes.string,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ConfigProductList(props) {
  const { configProducts } = props;
  return (
    <TableBody>
      {configProducts && configProducts.length > 0 ? (
        configProducts.map((configProduct, index) => (
          <Row key={index} row={configProduct} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={9} align="center">
            {" "}
            {/*Adjust colSpan*/}
            No config product properties found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ConfigProductList.propTypes = {
  configProducts: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ConfigProduct() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;

  const { host } = useUserState(); // Get host from UserContext

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [productId, setProductId] = useState("");
  const debouncedProductId = useDebounce(productId, 1000);
  const [configId, setConfigId] = useState(() => data?.configId || "");
  const debouncedConfigId = useDebounce(configId, 1000);
  const [configName, setConfigName] = useState(""); // Not in table, but in spec
  const debouncedConfigName = useDebounce(configName, 1000);
  const [propertyId, setPropertyId] = useState("");
  const debouncedPropertyId = useDebounce(propertyId, 1000);
  const [propertyName, setPropertyName] = useState("");
  const debouncedPropertyName = useDebounce(propertyName, 1000);
  const [propertyValue, setPropertyValue] = useState(""); // No debounce

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [configProducts, setConfigProducts] = useState([]);

  const handleProductIdChange = (event) => {
    setProductId(event.target.value);
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
  const handlePropertyValueChange = (event) => {
    setPropertyValue(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.description || "An error occurred.");
        setConfigProducts([]);
      } else {
        const data = await response.json();
        console.log("data = ", data);
        setConfigProducts(data.productProperties || []); // Adjust response key if needed
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Network or server error.");
      setConfigProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "config",
      action: "getConfigProduct",
      version: "0.1.0",
      data: {
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        hostId: host,
        productId: debouncedProductId,
        configId: debouncedConfigId,
        configName: debouncedConfigName,
        propertyId: debouncedPropertyId,
        propertyName: debouncedPropertyName,
        propertyValue: propertyValue,
      },
    };

    const url = `/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`;
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };

    fetchData(url, headers);
  }, [
    page,
    rowsPerPage,
    host,
    debouncedProductId,
    debouncedConfigId,
    debouncedConfigName,
    debouncedPropertyId,
    debouncedPropertyName,
    propertyValue,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreate = (configId) => {
    navigate("/app/form/createConfigProduct", {
      state: { data: { configId } },
    });
  };

  let content;

  if (loading) {
    content = <CircularProgress />;
  } else if (error) {
    content = <div style={{ color: "red" }}>Error: {error}</div>;
  } else {
    content = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="config product table">
            <TableHead>
              <TableRow className={classes.root}>
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
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Property Value"
                    value={propertyValue}
                    onChange={handlePropertyValueChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ConfigProductList configProducts={configProducts} />
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
        <AddBoxIcon onClick={() => handleCreate(configId)} />
      </div>
    );
  }

  return <div className="ConfigProduct">{content}</div>;
}
