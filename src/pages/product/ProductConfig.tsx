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

interface RowProps {
  row: {
    hostId: string;
    productVersionId: string;
    productId: string;
    productVersion: string;
    configId: string;
    configName: string;
    updateUser?: string;
    updateTs?: string;
  };
}

function Row(props: RowProps) {
  const { row } = props;
  const classes = useRowStyles();

  const handleDelete = async (row: RowProps['row']) => {
    if (
      window.confirm(
        "Are you sure you want to delete this product version config?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "product",
        action: "deleteProductVersionConfig",
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
      key={`${row.hostId}-${row.productVersionId}-${row.configId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.productVersionId}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.configId}</TableCell>
      <TableCell align="left">{row.configName}</TableCell>
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
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

interface ProductVersionConfigListProps {
  productVersionConfigs: any[]; // TODO: Define the type of productVersionConfigs
}

function ProductVersionConfigList(props: ProductVersionConfigListProps) {
  const { productVersionConfigs } = props;
  return (
    <TableBody>
      {productVersionConfigs && productVersionConfigs.length > 0 ? (
        productVersionConfigs.map((productVersionConfig: any, index: number) => (
          <Row key={index} row={productVersionConfig} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No product version configs found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ProductVersionConfigList.propTypes = {
  productVersionConfigs: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ProductConfig() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  const { host } = useUserState() as { host: string };
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [productVersionConfigs, setProductVersionConfigs] = useState([]);

  const handleProductVersionIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductVersionId(event.target.value);
  };
  const handleProductIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductId(event.target.value);
  };
  const handleProductVersionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductVersion(event.target.value);
  };
  const handleConfigIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfigId(event.target.value);
  };
  const handleConfigNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfigName(event.target.value);
  };

  const fetchData = useCallback(async (url: string, headers: { [key: string]: string }) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProductVersionConfigs([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProductVersionConfigs(data.productConfigs);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e: any) {
      console.log(e);
      setError(e.message);
      setProductVersionConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "product",
      action: "getProductVersionConfig",
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
    fetchData,
  ]);

  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (productVersionId: string, productId: string, productVersion: string) => {
    navigate("/app/form/createProductVersionConfig", {
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
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ProductVersionConfigList
              productVersionConfigs={productVersionConfigs}
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

  return <div className="ProductVersionConfig">{content}</div>;
}
