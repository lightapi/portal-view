import { useLocation, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  // Access the data from the state object
  const data = location.state?.data;
  console.log("data = ", data);

  const handleGoBack = () => {
    navigate("/");
  };

  return (
    <div>
      <h2>Success</h2>
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>No data received.</p>
      )}
      <Button variant="contained" color="primary" onClick={handleGoBack}>
        BACK TO DASHBOARD
      </Button>
    </div>
  );
}
