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
        "Are you sure you want to delete this product version pipeline?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "product",
        action: "deleteProductVersionPipeline",
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
      key={`${row.hostId}-${row.productVersionId}`}
    >
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.productVersionId}</TableCell>
      <TableCell align="left">{row.productId}</TableCell>
      <TableCell align="left">{row.productVersion}</TableCell>
      <TableCell align="left">{row.pipelineId}</TableCell>
      <TableCell align="left">{row.pipelineName}</TableCell>
      <TableCell align="left">{row.pipelineVersion}</TableCell>
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
    pipelineId: PropTypes.string.isRequired,
    pipelineName: PropTypes.string.isRequired,
    pipelineVersion: PropTypes.string.isRequired,
    updateUser: PropTypes.string,
    updateTs: PropTypes.string,
  }).isRequired,
};

function ProductVersionPipelineList(props) {
  const { productVersionPipelines } = props;
  return (
    <TableBody>
      {productVersionPipelines && productVersionPipelines.length > 0 ? (
        productVersionPipelines.map((productVersionPipeline, index) => (
          <Row key={index} row={productVersionPipeline} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No product version pipelines found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

ProductVersionPipelineList.propTypes = {
  productVersionPipelines: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ProductPipeline() {
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
  const [pipelineId, setPipelineId] = useState("");
  const debouncedPipelineId = useDebounce(pipelineId, 1000);
  const [pipelineName, setPipelineName] = useState("");
  const debouncedPipelineName = useDebounce(pipelineName, 1000);
  const [pipelineVersion, setPipelineVersion] = useState("");
  const debouncedPipelineVersion = useDebounce(pipelineVersion, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [productVersionPipelines, setProductVersionPipelines] = useState([]);

  const handleProductVersionIdChange = (event) => {
    setProductVersionId(event.target.value);
  };
  const handleProductIdChange = (event) => {
    setProductId(event.target.value);
  };
  const handleProductVersionChange = (event) => {
    setProductVersion(event.target.value);
  };
  const handlePipelineIdChange = (event) => {
    setPipelineId(event.target.value);
  };
  const handlePipelineNameChange = (event) => {
    setPipelineName(event.target.value);
  };
  const handlePipelineVersionChange = (event) => {
    setPipelineVersion(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setProductVersionPipelines([]);
      } else {
        const data = await response.json();
        console.log(data);
        setProductVersionPipelines(data.productPipelines);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setProductVersionPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "product",
      action: "getProductVersionPipeline",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        productVersionId: debouncedProductVersionId,
        productId: debouncedProductId,
        productVersion: debouncedProductVersion,
        pipelineId: debouncedPipelineId,
        pipelineName: debouncedPipelineName,
        pipelineVersion: debouncedPipelineVersion,
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
    debouncedPipelineId,
    debouncedPipelineName,
    debouncedPipelineVersion,
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
    navigate("/app/form/createProductVersionPipeline", {
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
                    placeholder="Pipeline Id"
                    value={pipelineId}
                    onChange={handlePipelineIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Name"
                    value={pipelineName}
                    onChange={handlePipelineNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Pipeline Version"
                    value={pipelineVersion}
                    onChange={handlePipelineVersionChange}
                  />
                </TableCell>
                <TableCell align="left">Update User</TableCell>
                <TableCell align="left">Update Time</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <ProductVersionPipelineList
              productVersionPipelines={productVersionPipelines}
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

  return <div className="ProductEnvironment">{content}</div>;
}
