import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { useApiPost } from "../../hooks/useApiPost";

export default function SubmitSpec() {
  const location = useLocation();
  const navigate = useNavigate();
  const { serviceVersion } = location.state;
  console.log("serviceVersion", serviceVersion);

  const body = {
    host: "lightapi.net",
    service: "service",
    action: "updateServiceSpec",
    version: "0.1.0",
    data: { ...serviceVersion },
  };
  const url = "/portal/command";
  const headers = {};
  const { isLoading, data, error } = useApiPost({ url, headers, body });
  console.log(isLoading, data, error);

  const onBackToService = () => {
    navigate("/app/service/register");
  };

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <div>
        <pre>{data ? JSON.stringify(data, null, 2) : "Unauthorized"}</pre>
        <Button
          variant="contained"
          color="primary"
          onClick={onBackToService}
          disabled={isLoading}
        >
          BACK TO SERVICE
        </Button>
      </div>
    );
  }

  return <div>{wait}</div>;
}
