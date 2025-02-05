import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody"; // Import TableBody
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import AttributionIcon from "@mui/icons-material/Attribution";
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { useUserState } from "../../contexts/UserContext";
import { makeStyles } from "@mui/styles";
import PropTypes from "prop-types";
import { apiPost } from "../../api/apiPost";

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

  const handleUpdate = (attribute) => {
    console.log("attribute = ", attribute);
    navigate("/app/form/updateAttribute", {
      state: { data: { ...attribute } },
    });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete the attribute for the host?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "attribute",
        action: "deleteAttribute",
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

  const handleAttributePermission = (attributeId) => {
    navigate("/app/access/attributePermission", { state: { data: { attributeId } } });
  };

  const handleAttributeRowFilter = (attributeId) => {
    navigate("/app/access/attributeRowFilter", { state: { data: { attributeId } } });
  };

  const handleAttributeColFilter = (attributeId) => {
    navigate("/app/access/attributeColFilter", { state: { data: { attributeId } } });
  };

  const handleAttributeUser = (attributeId) => {
    navigate("/app/access/attributeUser", {
      state: { data: { attributeId } },
    });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.attributeId}</TableCell>
      <TableCell align="left">{row.attributeType}</TableCell>
      <TableCell align="left">{row.attributeDesc}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon onClick={() => handleAttributePermission(row.attributeId)} />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowDownIcon
          onClick={() => handleAttributeRowFilter(row.attributeId)}
        />
      </TableCell>
      <TableCell align="right">
        <KeyboardDoubleArrowRightIcon
          onClick={() => handleAttributeColFilter(row.attributeId)}
        />
      </TableCell>
      <TableCell align="right">
        <AttributionIcon onClick={() => handleAttributeUser(row.attributeId)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    attributeId: PropTypes.string.isRequired,
    attributeType: PropTypes.string,
    attributeDesc: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function AttributeList(props) {
  const { attributes } = props;
  return (
    <TableBody>
      {attributes && attributes.length > 0 ? (
        attributes.map((attribute, index) => (
          <Row key={index} row={attribute} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={3} align="center">
            No attributes found.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

AttributeList.propTypes = {
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function AttributeAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [attributeId, setAttributeId] = useState("");
  const debouncedAttributeId = useDebounce(attributeId, 1000);
  const [attributeType, setAttributeType] = useState("");
  const debouncedAttributeType = useDebounce(attributeType, 1000);
  const [attributeDesc, setAttributeDesc] = useState("");
  const debouncedAttributeDesc = useDebounce(attributeDesc, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [attributes, setAttributes] = useState([]);

  const handleAttributeIdChange = (event) => {
    setAttributeId(event.target.value);
  };
  const handleAttributeTypeChange = (event) => {
    setAttributeType(event.target.value);
  };
  const handleAttributeDescChange = (event) => {
    setAttributeDesc(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setAttributes([]);
      } else {
        const data = await response.json();
        setAttributes(data.attributes);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "attribute",
      action: "getAttribute",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        attributeId: debouncedAttributeId,
        attributeType: debouncedAttributeType,
        attributeDesc: debouncedAttributeDesc,
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
    debouncedAttributeId,
    debouncedAttributeType,
    debouncedAttributeDesc,
    fetchData, // Add fetchData to dependency array of useEffect
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createAttribute");
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
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Id"
                    value={attributeId}
                    onChange={handleAttributeIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Type"
                    value={attributeType}
                    onChange={handleAttributeTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Attribute Desc"
                    value={attributeDesc}
                    onChange={handleAttributeDescChange}
                  />
                </TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Attribute Permission</TableCell>
                <TableCell align="right">Role Row Filter</TableCell>
                <TableCell align="right">Role Col Filter</TableCell>
                <TableCell align="right">Attribute User</TableCell>
              </TableRow>
            </TableHead>
            <AttributeList attributes={attributes} />
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

  return <div className="App">{content}</div>;
}
