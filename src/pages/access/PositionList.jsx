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

  const handleUpdate = (position) => {
    console.log("position = ", position);
    navigate("/app/form/updatePosition", { state: { data: { ...position } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete the position for the host?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deletePosition",
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

  const handleApiPosition = (position) => {
    console.log("position", position);
    navigate("/app/apiPosition", { state: { position } });
  };

  const handleUserPosition = (position) => {
    console.log("position", position);
    navigate("/app/userPosition", { state: { position } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.positionId}</TableCell>
      <TableCell align="left">{row.positionDesc}</TableCell>
      <TableCell align="left">{row.inheritToAncestor}</TableCell>
      <TableCell align="left">{row.inheritToSibline}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleApiPosition(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleUserPosition(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    positionId: PropTypes.string.isRequired,
    positionDesc: PropTypes.string,
    inheritToAncestor: PropTypes.string,
    inheritToSibline: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

PositionList.propTypes = {
  positions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function PositionList(props) {
  const { positions } = props;
  console.log("positions", positions);
  return (
    <TableBody>
      {positions.map((position, index) => (
        <Row key={index} row={position} />
      ))}
    </TableBody>
  );
}
