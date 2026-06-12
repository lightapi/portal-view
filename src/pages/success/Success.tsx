import { useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { signOut, useUserDispatch, useUserState } from "../../contexts/UserContext";

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const userDispatch = useUserDispatch();
  const { userId }: any = useUserState();
  // Access the data from the state object
  const data = location.state?.data;
  const isHostOwner = data?.hostOwner && userId && data.hostOwner === userId;
  const showClaimOrgRelogin = data?.reloginRequiredForHostOwner === true;
  console.log("data = ", data);

  const handleGoBack = () => {
    navigate("/");
  };

  const handleSignOut = () => {
    signOut(userDispatch, navigate);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Success</Typography>
      {showClaimOrgRelogin ? (
        <Alert
          severity="info"
          action={
            isHostOwner ? (
              <Button color="inherit" size="small" onClick={handleSignOut}>
                LOG OUT
              </Button>
            ) : undefined
          }
        >
          {isHostOwner
            ? "Your current host was switched to the newly created host. Log out and log in again to access it with the new host and role claims."
            : "The host owner's current host was switched to the newly created host. The host owner must log out and log in again before accessing it."}
        </Alert>
      ) : null}
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>No data received.</p>
      )}
      <Button variant="contained" color="primary" onClick={handleGoBack}>
        BACK TO DASHBOARD
      </Button>
    </Stack>
  );
}
