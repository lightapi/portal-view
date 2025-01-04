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

  const handleUpdate = (group) => {
    navigate("/app/form/updateGroup", { state: { data: { ...group } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the group for the host?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteGroup",
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

  const handleApiGroup = (group) => {
    console.log("group", group);
    navigate("/app/apiGroup", { state: { group } });
  };

  const handleUserGroup = (group) => {
    console.log("group", group);
    navigate("/app/userGroup", { state: { group } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.groupId}</TableCell>
      <TableCell align="left">{row.groupDesc}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleApiGroup(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleUserGroup(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    groupId: PropTypes.string.isRequired,
    groupDesc: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

GroupList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function GroupList(props) {
  const { groups } = props;
  console.log("groups", groups);
  return (
    <TableBody>
      {groups.map((group, index) => (
        <Row key={index} row={group} />
      ))}
    </TableBody>
  );
}
