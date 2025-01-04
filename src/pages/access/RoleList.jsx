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

  const handleUpdate = (role) => {
    console.log("role = ", role);
    navigate("/app/form/updateRole", { state: { data: { ...role } } });
  };

  const handleDelete = async (row) => {
    if (
      window.confirm("Are you sure you want to delete the role for the host?")
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "market",
        action: "deleteRole",
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

  const handleApiRole = (role) => {
    console.log("role", role);
    navigate("/app/apiRole", { state: { role } });
  };

  const handleUserRole = (role) => {
    console.log("role", role);
    navigate("/app/userRole", { state: { role } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.roleId}</TableCell>
      <TableCell align="left">{row.roleDesc}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleApiRole(row)} />
      </TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleUserRole(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    roleId: PropTypes.string.isRequired,
    roleDesc: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

RoleList.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RoleList(props) {
  const { roles } = props;
  console.log("roles", roles);
  return (
    <TableBody>
      {roles.map((role, index) => (
        <Row key={index} row={role} />
      ))}
    </TableBody>
  );
}
