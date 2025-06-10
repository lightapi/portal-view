import { useLocation, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";

export default function Failure() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state?.data;
  console.log("data = ", data);
  const handleGoBack = () => {
    navigate("/");
  };

  return (
    <div>
      <h2>Failure</h2>
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
