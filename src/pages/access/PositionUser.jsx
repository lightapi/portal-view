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
import { useEffect, useState, useCallback } from "react";
import useDebounce from "../../hooks/useDebounce.js";
import { useLocation, useNavigate } from "react-router-dom";
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
  const { row } = props;
  const classes = useRowStyles();

  const handleDelete = async (row) => {
    if (
      window.confirm(
        "Are you sure you want to delete the position for the api?",
      )
    ) {
      const cmd = {
        host: "lightapi.net",
        service: "position",
        action: "deletePositionUser",
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

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.positionId}</TableCell>
      <TableCell align="left">{row.positionType}</TableCell>
      <TableCell align="left">{row.startDate}</TableCell>
      <TableCell align="left">{row.endDate}</TableCell>
      <TableCell align="left">{row.userId}</TableCell>
      <TableCell align="left">{row.entityId}</TableCell>
      <TableCell align="left">{row.email}</TableCell>
      <TableCell align="left">{row.firstName}</TableCell>
      <TableCell align="left">{row.lastName}</TableCell>
      <TableCell align="left">{row.userType}</TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row)} />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    positionId: PropTypes.string.isRequired,
    positionType: PropTypes.string,
    startDate: PropTypes.date,
    endDate: PropTypes.date,
    userId: PropTypes.string,
    entityId: PropTypes.string,
    email: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    userType: PropTypes.string,
    hostId: PropTypes.string.isRequired,
  }).isRequired,
};

function PositionUserList(props) {
  const { positionUsers } = props;
  return (
    <TableBody>
      {positionUsers && positionUsers.length > 0 ? (
        positionUsers.map((positionUser, index) => (
          <Row key={index} row={positionUser} />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={2} align="center">
            No users assigned to this position.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

PositionUserList.propTypes = {
  positionUsers: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function PositionUser() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const location = useLocation();
  const data = location.state?.data;

  const [positionId, setPositionId] = useState(() => data?.positionId || "");
  const debouncedPositionId = useDebounce(positionId, 1000);
  const [positionType, setPositionType] = useState("");
  const debouncedPositionType = useDebounce(positionType, 1000);
  const [startDate, setStartDate] = useState("");
  const debouncedStartDate = useDebounce(startDate, 1000);
  const [endDate, setEndDate] = useState("");
  const debouncedEndDate = useDebounce(endDate, 1000);
  const [userId, setUserId] = useState(() => data?.userId || "");
  const debouncedUserId = useDebounce(userId, 1000);
  const [entityId, setEntityId] = useState("");
  const debouncedEntityId = useDebounce(entityId, 1000);
  const [email, setEmail] = useState("");
  const debouncedEmail = useDebounce(email, 1000);
  const [firstName, setFirstName] = useState("");
  const debouncedFirstName = useDebounce(firstName, 1000);
  const [lastName, setLastName] = useState("");
  const debouncedLastName = useDebounce(lastName, 1000);
  const [userType, setUserType] = useState("");
  const debouncedUserType = useDebounce(userType, 1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [positionUsers, setPositionUsers] = useState([]);

  const handlePositionIdChange = (event) => {
    setPositionId(event.target.value);
  };
  const handlePositionTypeChange = (event) => {
    setPositionType(event.target.value);
  };
  const handleStartDateChange = (event) => {
    setStartDate(event.target.value);
  };
  const handleEndDateChange = (event) => {
    setEndDate(event.target.value);
  };

  const handleUserIdChange = (event) => {
    setUserId(event.target.value);
  };

  const handleEntityIdChange = (event) => {
    setEntityId(event.target.value);
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handleFirstNameChange = (event) => {
    setFirstName(event.target.value);
  };

  const handleLastNameChange = (event) => {
    setLastName(event.target.value);
  };

  const handleUserTypeChange = (event) => {
    setUserType(event.target.value);
  };

  const fetchData = useCallback(async (url, headers) => {
    // Wrap fetchData with useCallback
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setPositionUsers([]);
      } else {
        const data = await response.json();
        setPositionUsers(data.positionUsers);
        setTotal(data.total);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setPositionUsers([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "position",
      action: "queryPositionUser",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        positionId: debouncedPositionId,
        positionType: debouncedPositionType,
        startDate: debouncedStartDate,
        endDate: debouncedEndDate,
        userId: debouncedUserId,
        entityId: debouncedEntityId,
        email: debouncedEmail,
        firstName: debouncedFirstName,
        lastName: debouncedLastName,
        userType: debouncedUserType,
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
    debouncedPositionId,
    debouncedPositionType,
    debouncedStartDate,
    debouncedEndDate,
    debouncedUserId,
    debouncedEntityId,
    debouncedEmail,
    debouncedFirstName,
    debouncedLastName,
    debouncedUserType,
    fetchData, // Add fetchData to dependency array of useEffect
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleCreate = (positionId, userId) => {
    navigate("/app/form/createPositionUser", {
      state: { data: { positionId, userId } },
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
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Position Id"
                    value={positionId}
                    onChange={handlePositionIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Position Type"
                    value={positionType}
                    onChange={handlePositionTypeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Start Date"
                    value={startDate}
                    onChange={handleStartDateChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="End Date"
                    value={endDate}
                    onChange={handleEndDateChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="User Id"
                    value={userId}
                    onChange={handleUserIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Entity Id"
                    value={entityId}
                    onChange={handleEntityIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Email"
                    value={email}
                    onChange={handleEmailChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={handleFirstNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={handleLastNameChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="User Type"
                    value={userType}
                    onChange={handleUserTypeChange}
                  />
                </TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <PositionUserList positionUsers={positionUsers} />
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
        <AddBoxIcon onClick={() => handleCreate(positionId, userId)} />
      </div>
    );
  }

  return <div className="App">{content}</div>;
}
