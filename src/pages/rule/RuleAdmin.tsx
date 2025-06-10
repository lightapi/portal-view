import AddBoxIcon from "@mui/icons-material/AddBox";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody"; // Import TableBody
import { useEffect, useState, useCallback } from "react";
import Cookies from "universal-cookie";
import { useNavigate } from "react-router-dom";
import { makeStyles } from "@mui/styles";
import useDebounce from "../../hooks/useDebounce.js";
import { useUserState } from "../../contexts/UserContext";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
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

function RuleList(props) {
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

RuleList.propTypes = {
  rules: PropTypes.arrayOf(PropTypes.object).isRequired,
};

RuleList.defaultProps = {
  rules: [], // Default empty array to prevent errors during startup Router check.
};

export default function RuleAdmin() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [ruleId, setRuleId] = useState("");
  const debouncedRuleId = useDebounce(ruleId, 1000);
  const [ruleName, setRuleName] = useState("");
  const debouncedRuleName = useDebounce(ruleName, 1000);
  const [ruleVersion, setRuleVersion] = useState("");
  const debouncedRuleVersion = useDebounce(ruleVersion, 1000);
  const [ruleType, setRuleType] = useState("");
  const debouncedRuleType = useDebounce(ruleType, 1000);
  const [ruleGroup, setRuleGroup] = useState("");
  const debouncedRuleGroup = useDebounce(ruleGroup, 1000);
  const [common, setCommon] = useState("");
  const debouncedCommon = useDebounce(common, 1000);
  const [apiDesc, setApiDesc] = useState("");
  const debouncedApiDesc = useDebounce(apiDesc, 1000);
  const [ruleBody, setRuleBody] = useState("");
  const debouncedRuleBody = useDebounce(ruleBody, 1000);
  const [ruleOwner, setRuleOwner] = useState("");
  const debouncedRuleOwner = useDebounce(ruleOwner, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [rules, setRules] = useState([]);

  // Handlers for the new state variables
  const handleRuleIdChange = (event) => {
    setRuleId(event.target.value);
  };
  const handleRuleNameChange = (event) => {
    setRuleName(event.target.value);
  };
  const handleRuleVersionChange = (event) => {
    setRuleVersion(event.target.value);
  };
  const handleRuleTypeChange = (event) => {
    setRuleType(event.target.value);
  };
  const handleRuleGroupChange = (event) => {
    setRuleGroup(event.target.value);
  };
  const handleCommonChange = (event) => {
    setCommon(event.target.value);
  };
  const handleApiDescChange = (event) => {
    setApiDesc(event.target.value);
  };
  const handleRuleBodyChange = (event) => {
    setRuleBody(event.target.value);
  };
  const handleRuleOwnerChange = (event) => {
    setRuleOwner(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setRules([]);
      } else {
        const data = await response.json();
        setRules(data.rules);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "rule",
      action: "getRule",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        ruleId: debouncedRuleId,
        ruleName: debouncedRuleName,
        ruleVersion: debouncedRuleVersion,
        ruleType: debouncedRuleType,
        ruleGroup: debouncedRuleGroup,
        common: debouncedCommon,
        apiDesc: debouncedApiDesc,
        ruleBody: debouncedRuleBody,
        ruleOwner: debouncedRuleOwner,
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
    debouncedRuleId,
    debouncedRuleName,
    debouncedRuleVersion,
    debouncedRuleType,
    debouncedRuleGroup,
    debouncedCommon,
    debouncedApiDesc,
    debouncedRuleBody,
    debouncedRuleOwner,
    fetchData,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = () => {
    navigate("/app/form/createRule");
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
                    placeholder="Rule Id"
                    value={ruleId}
                    onChange={handleRuleIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Name"
                    value={ruleName}
                    onChange={handleRuleNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Version"
                    value={ruleVersion}
                    onChange={handleRuleVersionChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Type"
                    value={ruleType}
                    onChange={handleRuleTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Group"
                    value={ruleGroup}
                    onChange={handleRuleGroupChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Common"
                    value={common}
                    onChange={handleCommonChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Api Desc"
                    value={apiDesc}
                    onChange={handleApiDescChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Body"
                    value={ruleBody}
                    onChange={handleRuleBodyChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Rule Owner"
                    value={ruleOwner}
                    onChange={handleRuleOwnerChange}
                  />
                </TableCell>
                <TableCell align="right">Detail</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <RuleList rules={rules} />
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
