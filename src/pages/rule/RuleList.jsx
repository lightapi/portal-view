import makeStyles from "@mui/styles/makeStyles";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useUserState } from "../../contexts/UserContext";

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
  const { host } = useUserState();

  const handleUpdate = (rule) => {
    console.log("rule = ", rule);
    navigate("/app/form/updateRule", { state: { rule } }); // Adjust route as needed
  };

  const handleDelete = (ruleId) => {
    if (window.confirm("Are you sure you want to delete the rule?")) {
      navigate("/app/deleteRule", { state: { data: { host, ruleId } } }); // Adjust route as needed
    }
  };

  const handleDetail = (rule) => {
    console.log("rule", rule);
    navigate("/app/ruleDetail", { state: { rule } }); // Adjust route as needed
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.ruleId}</TableCell>
      <TableCell align="left">{row.ruleName}</TableCell>
      <TableCell align="left">{row.ruleVersion}</TableCell>
      <TableCell align="left">{row.ruleType}</TableCell>
      <TableCell align="left">{row.ruleGroup}</TableCell>
      <TableCell align="left">{row.common}</TableCell>
      <TableCell align="left">{row.apiDesc}</TableCell>
      <TableCell align="left">{row.ruleBody}</TableCell>
      <TableCell align="left">{row.ruleOwner}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleDetail(row)} />
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row.ruleId)} />
      </TableCell>
    </TableRow>
  );
}

Row.propTypes = {
  row: PropTypes.shape({
    ruleId: PropTypes.string.isRequired,
    ruleName: PropTypes.string,
    ruleVersion: PropTypes.string,
    ruleType: PropTypes.string,
    ruleGroup: PropTypes.string,
    common: PropTypes.string,
    apiDesc: PropTypes.string, // Consider removing if not used
    ruleBody: PropTypes.string,
    ruleOwner: PropTypes.string,
    host: PropTypes.string,
  }).isRequired,
};

RuleList.propTypes = {
  rules: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function RuleList(props) {
  const { rules } = props;
  console.log("rules", rules);
  return (
    <TableBody>
      {rules.map((rule, index) => (
        <Row key={index} row={rule} />
      ))}
    </TableBody>
  );
}
