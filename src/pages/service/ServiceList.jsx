import makeStyles from "@mui/styles/makeStyles";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import SettingsIcon from "@mui/icons-material/Settings";
import ImageAspectRatioIcon from "@mui/icons-material/ImageAspectRatio";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import InputIcon from "@mui/icons-material/Input";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

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

  const handleUpdate = (service) => {
    console.log("service = ", service);
    navigate("/app/form/updateService", { state: { service } });
  };

  const handleDelete = (hostId, apiId) => {
    if (window.confirm("Are you sure you want to delete the service?")) {
      navigate("/app/deleteService", { state: { data: { hostId, apiId } } });
    }
  };

  const handleDetail = (service) => {
    console.log("service", service);
    navigate("/app/serviceDetail", { state: { service } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.apiId}</TableCell>
      <TableCell align="left">{row.apiName}</TableCell>
      <TableCell align="left">{row.apiType}</TableCell>
      <TableCell align="left">{row.apiDesc}</TableCell>
      <TableCell align="left">{row.operationOwner}</TableCell>
      <TableCell align="left">{row.deliveryOwner}</TableCell>
      <TableCell align="left">{row.region}</TableCell>
      <TableCell align="left">{row.businessGroup}</TableCell>
      <TableCell align="left">{row.lob}</TableCell>
      <TableCell align="left">{row.platform}</TableCell>
      <TableCell align="left">{row.capability}</TableCell>
      <TableCell align="left">{row.gitRepo}</TableCell>
      <TableCell align="left">{row.apiTags}</TableCell>
      <TableCell align="left">{row.apiStatus}</TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleDetail(row)} />
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

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    apiId: PropTypes.string.isRequired,
    apiName: PropTypes.string,
    apiType: PropTypes.string,
    apiDesc: PropTypes.string,
    operationOwner: PropTypes.string,
    deliveryOwner: PropTypes.string,
    region: PropTypes.string,
    businessGroup: PropTypes.string,
    lob: PropTypes.string,
    platform: PropTypes.string,
    capability: PropTypes.string,
    gitRepo: PropTypes.string,
    apiTags: PropTypes.string,
    apiStatus: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

ServiceList.propTypes = {
  services: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function ServiceList(props) {
  const { services } = props;
  console.log("services", services);
  return (
    <TableBody>
      {services.map((service, index) => (
        <Row key={index} row={service} />
      ))}
    </TableBody>
  );
}
