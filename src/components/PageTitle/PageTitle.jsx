import { Button } from "@mui/material";
import { Typography } from "../Wrappers/Wrappers";
import useStyles from "./styles";

export default function PageTitle(props) {
  var classes = useStyles();

  return (
    <div className={classes.pageTitleContainer}>
      <Typography className={classes.typo} variant="h4" size="sm">
        {props.title}
      </Typography>
      {props.button && (
        <Button
          classes={{ root: classes.button }}
          variant="contained"
          size="large"
          color="secondary"
        >
          {props.button}
        </Button>
      )}
    </div>
  );
}
