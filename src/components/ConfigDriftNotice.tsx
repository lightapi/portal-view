import { useEffect, useState } from "react";
import { Button, Snackbar } from "@mui/material";
import { checkConfigDrift, initialConfigDigest } from "../runtimeConfig/digest";

export const DRIFT_CHECK_INTERVAL_MS = 300_000;

export default function ConfigDriftNotice() {
  const [driftDetected, setDriftDetected] = useState(false);

  useEffect(() => {
    if (!initialConfigDigest) return;

    let active = true;
    const check = async () => {
      try {
        const changed = await checkConfigDrift();
        if (active && changed) setDriftDetected(true);
      } catch {
        // A failed check must not hide an already detected change.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    const interval = window.setInterval(() => void check(), DRIFT_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <Snackbar
      open={driftDetected}
      autoHideDuration={null}
      message="Portal configuration changed. Reload to apply."
      action={<Button color="inherit" onClick={() => window.location.reload()}>Reload</Button>}
    />
  );
}
