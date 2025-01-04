import makeStyles from "@mui/styles/makeStyles";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import DetailsIcon from "@mui/icons-material/Details";
import { useNavigate } from "react-router-dom";
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
        service: "market",
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

  const handleApiAttribute = (attribute) => {
    console.log("attribute", attribute);
    navigate("/app/apiAttribute", { state: { attribute } });
  };

  const handleUserAttribute = (attribute) => {
    console.log("attribute", attribute);
    navigate("/app/userAttribute", { state: { attribute } });
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
        <DetailsIcon onClick={() => handleApiAttribute(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleUserAttribute(row)} />
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

AttributeList.propTypes = {
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function AttributeList(props) {
  const { attributes } = props;
  console.log("attributes", attributes);
  return (
    <TableBody>
      {attributes.map((attribute, index) => (
        <Row key={index} row={attribute} />
      ))}
    </TableBody>
  );
}
