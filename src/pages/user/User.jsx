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
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import CameraRollIcon from "@mui/icons-material/CameraRoll";
import AttributionIcon from "@mui/icons-material/Attribution";
import GroupsIcon from "@mui/icons-material/Groups";
import RadarIcon from "@mui/icons-material/Radar";
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import DetailsIcon from "@mui/icons-material/Details";
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

  const handleUpdate = (user) => {
    navigate("/app/form/updateUser", { state: { data: { ...user } } });
  };

  const handleRoleUser = (hostId, userId) => {
    navigate("/app/access/roleUser", { state: { data: { hostId, userId } } });
  };

  const handleGroupUser = (hostId, userId) => {
    navigate("/app/access/groupUser", { state: { data: { hostId, userId } } });
  };

  const handlePositionUser = (hostId, userId) => {
    navigate("/app/access/positionUser", {
      state: { data: { hostId, userId } },
    });
  };

  const handleAttributeUser = (hostId, userId) => {
    navigate("/app/access/attributeUser", {
      state: { data: { hostId, userId } },
    });
  };

  const handlePermission = (hostId, userId) => {
    navigate("/app/access/userPermission", {
      state: { data: { hostId, userId } },
    });
  };

  const handleDelete = async (hostId, userId) => {
    if (window.confirm("Are you sure you want to delete the user?")) {
      const cmd = {
        host: "lightapi.net",
        service: "user",
        action: "deleteUserById",
        version: "0.1.0",
        data: {
          hostId,
          userId,
        },
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

  const handleDetail = (user) => {
    navigate("/app/userDetail", { state: { user } });
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.userId}</TableCell>
      <TableCell align="left">{row.email}</TableCell>
      <TableCell align="left">{row.language}</TableCell>
      <TableCell align="left">{row.userType}</TableCell>
      <TableCell align="left">{row.entityId}</TableCell>
      <TableCell align="left">{row.referralId}</TableCell>
      <TableCell align="left">{row.managerId}</TableCell>
      <TableCell align="left">{row.firstName}</TableCell>
      <TableCell align="left">{row.lastName}</TableCell>
      <TableCell align="left">{row.phoneNumber}</TableCell>
      <TableCell align="left">{row.gender}</TableCell>
      <TableCell align="left">{row.birthday}</TableCell>
      <TableCell align="left">{row.country}</TableCell>
      <TableCell align="left">{row.province}</TableCell>
      <TableCell align="left">{row.city}</TableCell>
      <TableCell align="left">{row.address}</TableCell>
      <TableCell align="left">{row.postCode}</TableCell>
      <TableCell align="left">{row.verified ? "Y" : "N"}</TableCell>
      <TableCell align="left">{row.locked ? "Y" : "N"}</TableCell>
      <TableCell align="right">
        <DetailsIcon onClick={() => handleDetail(row)} />
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon
          onClick={() => handleDelete(row.hostId, row.userId)}
        />
      </TableCell>
      <TableCell align="right">
        <CameraRollIcon
          onClick={() => handleRoleUser(row.hostId, row.userId)}
        />
      </TableCell>
      <TableCell align="right">
        <GroupsIcon onClick={() => handleGroupUser(row.hostId, row.userId)} />
      </TableCell>
      <TableCell align="right">
        <RadarIcon onClick={() => handlePositionUser(row.hostId, row.userId)} />
      </TableCell>
      <TableCell align="right">
        <AttributionIcon
          onClick={() => handleAttributeUser(row.hostId, row.userId)}
        />
      </TableCell>
      <TableCell align="right">
        <DoNotTouchIcon
          onClick={() => handlePermission(row.hostId, row.userId)}
        />
      </TableCell>
    </TableRow>
  );
}

// Add propTypes validation for Row
Row.propTypes = {
  row: PropTypes.shape({
    hostId: PropTypes.string.isRequired,
    userId: PropTypes.string.isRequired,
    email: PropTypes.string,
    language: PropTypes.string,
    userType: PropTypes.string,
    entityId: PropTypes.string,
    referralId: PropTypes.string,
    managerId: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    phoneNumber: PropTypes.string,
    gender: PropTypes.string,
    birthday: PropTypes.string,
    country: PropTypes.string,
    province: PropTypes.string,
    city: PropTypes.string,
    address: PropTypes.string,
    postCode: PropTypes.string,
    verified: PropTypes.bool.isRequired,
    locked: PropTypes.bool.isRequired,
  }).isRequired,
};

function UserList(props) {
  const { users } = props;
  return (
    <TableBody>
      {users.map((user, index) => (
        <Row key={index} row={user} />
      ))}
    </TableBody>
  );
}

UserList.propTypes = {
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function User() {
  const classes = useRowStyles();
  const navigate = useNavigate();
  const { host } = useUserState();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [email, setEmail] = useState("");
  const debouncedEmail = useDebounce(email, 1000);
  const [language, setLanguage] = useState("");
  const debouncedLanguage = useDebounce(language, 1000);
  const [userType, setUserType] = useState("");
  const debouncedUserType = useDebounce(userType, 1000);
  const [entityId, setEntityId] = useState("");
  const debouncedEntityId = useDebounce(entityId, 1000);
  const [referralId, setReferralId] = useState("");
  const debouncedReferralId = useDebounce(referralId, 1000);
  const [managerId, setManagerId] = useState("");
  const debouncedManagerId = useDebounce(managerId, 1000);
  const [firstName, setFirstName] = useState("");
  const debouncedFirstName = useDebounce(firstName, 1000);
  const [lastName, setLastName] = useState("");
  const debouncedLastName = useDebounce(lastName, 1000);
  const [phoneNumber, setPhoneNumber] = useState("");
  const debouncedPhoneNumber = useDebounce(phoneNumber, 1000);
  const [gender, setGender] = useState("");
  const debouncedGender = useDebounce(gender, 1000);
  const [birthday, setBirthday] = useState("");
  const debouncedBirthday = useDebounce(birthday, 1000);
  const [country, setCountry] = useState("");
  const debouncedCountry = useDebounce(country, 1000);
  const [province, setProvince] = useState("");
  const debouncedProvince = useDebounce(province, 1000);
  const [city, setCity] = useState("");
  const debouncedCity = useDebounce(city, 1000);
  const [address, setAddress] = useState("");
  const debouncedAddress = useDebounce(address, 1000);
  const [postCode, setPostCode] = useState("");
  const debouncedPostCode = useDebounce(postCode, 1000);
  const [verified, setVerified] = useState(true);
  const debouncedVerified = useDebounce(verified, 1000);
  const [locked, setLocked] = useState(false);
  const debouncedLocked = useDebounce(locked, 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };
  const handleLanguageChange = (event) => {
    setLanguage(event.target.value);
  };
  const handleUserTypeChange = (event) => {
    setUserType(event.target.value);
  };
  const handleEntityIdChange = (event) => {
    setEntityId(event.target.value);
  };
  const handleReferralIdChange = (event) => {
    setReferralId(event.target.value);
  };
  const handleManagerIdChange = (event) => {
    setManagerId(event.target.value);
  };
  const handleFirstNameChange = (event) => {
    setFirstName(event.target.value);
  };
  const handleLastNameChange = (event) => {
    setLastName(event.target.value);
  };
  const handlePhoneNumberChange = (event) => {
    setPhoneNumber(event.target.value);
  };
  const handleGenderChange = (event) => {
    setGender(event.target.value);
  };
  const handleBirthdayChange = (event) => {
    setBirthday(event.target.value);
  };
  const handleCountryChange = (event) => {
    setCountry(event.target.value);
  };
  const handleProvinceChange = (event) => {
    setProvince(event.target.value);
  };
  const handleCityChange = (event) => {
    setCity(event.target.value);
  };
  const handleAddressChange = (event) => {
    setAddress(event.target.value);
  };
  const handlePostCodeChange = (event) => {
    setPostCode(event.target.value);
  };
  const handleVerifiedChange = (event) => {
    const booleanValue =
      event.target.value === "Y" || event.target.value === "y";
    setVerified(booleanValue);
  };
  const handleLockedChange = (event) => {
    const booleanValue =
      event.target.value === "Y" || event.target.value === "y";
    setLocked(booleanValue);
  };

  const fetchData = useCallback(async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        setError(error.description);
        setUsers([]);
      } else {
        const data = await response.json();
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (e) {
      setError(e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cmd = {
      host: "lightapi.net",
      service: "user",
      action: "listUserByHostId",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: page * rowsPerPage,
        limit: rowsPerPage,
        email: debouncedEmail,
        language: debouncedLanguage,
        userType: debouncedUserType,
        entityId: debouncedEntityId,
        referralId: debouncedReferralId,
        managerId: debouncedManagerId,
        firstName: debouncedFirstName,
        lastName: debouncedLastName,
        phoneNumber: debouncedPhoneNumber,
        gender: debouncedGender,
        birthday: debouncedBirthday,
        country: debouncedCountry,
        province: debouncedProvince,
        city: debouncedCity,
        address: debouncedAddress,
        postCode: debouncedPostCode,
        verified: debouncedVerified,
        locked: debouncedLocked,
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
    debouncedEmail,
    debouncedLanguage,
    debouncedUserType,
    debouncedEntityId,
    debouncedReferralId,
    debouncedManagerId,
    debouncedFirstName,
    debouncedLastName,
    debouncedPhoneNumber,
    debouncedGender,
    debouncedBirthday,
    debouncedCountry,
    debouncedProvince,
    debouncedCity,
    debouncedAddress,
    debouncedPostCode,
    debouncedVerified,
    debouncedLocked,
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
    navigate("/app/form/createUser");
  };

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    wait = (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    wait = (
      <div>
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow className={classes.root}>
                <TableCell align="left">
                  <input type="text" placeholder="User Id" disabled />
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
                    placeholder="Language"
                    value={language}
                    onChange={handleLanguageChange}
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
                    placeholder="Referral Id"
                    value={referralId}
                    onChange={handleReferralIdChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Manager Id"
                    value={managerId}
                    onChange={handleManagerIdChange}
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
                    placeholder="Phone Number"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Gender"
                    value={gender}
                    onChange={handleGenderChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Birthday"
                    value={birthday}
                    onChange={handleBirthdayChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Country"
                    value={country}
                    onChange={handleCountryChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Province"
                    value={province}
                    onChange={handleProvinceChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={handleCityChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Address"
                    value={address}
                    onChange={handleAddressChange}
                  />
                </TableCell>
                <TableCell align="left">
                  <input
                    type="text"
                    placeholder="Post Code"
                    value={postCode}
                    onChange={handlePostCodeChange}
                  />
                </TableCell>
                <TableCell align="left">
                  Verified
                  <input
                    type="text"
                    placeholder="Verified"
                    value={verified ? "Y" : "N"}
                    onChange={handleVerifiedChange}
                  />
                </TableCell>
                <TableCell align="left">
                  Locked
                  <input
                    type="text"
                    placeholder="Locked"
                    value={locked ? "Y" : "N"}
                    onChange={handleLockedChange}
                  />
                </TableCell>
                <TableCell align="right">Detail</TableCell>
                <TableCell align="right">Update</TableCell>
                <TableCell align="right">Delete</TableCell>
                <TableCell align="right">Role</TableCell>
                <TableCell align="right">Group</TableCell>
                <TableCell align="right">Position</TableCell>
                <TableCell align="right">Attribute</TableCell>
                <TableCell align="right">Permission</TableCell>
              </TableRow>
            </TableHead>
            <UserList users={users} />
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

  return <div className="App">{wait}</div>;
}
