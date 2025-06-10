// import { makeStyles } from "@mui/styles";
import { makeStyles } from '@mui/styles';

export default makeStyles((theme) => ({
  buttonHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '60px',
  },
  card: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  visitsNumberContainer: {
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
    paddingBottom: theme.spacing(1),
  },
  progressSection: {
    marginBottom: theme.spacing(1),
  },
  progressTitle: {
    marginBottom: theme.spacing(2),
  },
  progress: {
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.primary.main,
  },
  pieChartLegendWrapper: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: theme.spacing(1),
  },
  legendItemContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  fullHeightBody: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  tableWidget: {
    overflowX: 'auto',
  },
  progressBar: {
    backgroundColor: theme.palette.warning.main,
  },
  performanceLegendWrapper: {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  legendElement: {
    display: 'flex',
    alignItems: 'center',
    marginRight: theme.spacing(2),
    marginTop: '8px',
  },
  legendElementText: {
    marginLeft: theme.spacing(1),
  },
  serverOverviewElement: {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '100%',
  },
  serverOverviewElementText: {
    minWidth: 145,
    paddingRight: theme.spacing(2),
  },
  serverOverviewElementChartWrapper: {
    width: '100%',
  },
  mainChartBody: {
    overflowX: 'auto',
  },
  mainChartHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    [theme.breakpoints.only('xs')]: {
      flexWrap: 'wrap',
    },
  },
  mainChartHeaderLabels: {
    display: 'flex',
    alignItems: 'center',
    [theme.breakpoints.only('xs')]: {
      order: 3,
      width: '100%',
      justifyContent: 'center',
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(2),
    },
  },
  mainChartHeaderLabel: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: theme.spacing(3),
  },
  mainChartSelectRoot: {
    borderColor: theme.palette.text.hint + '80 !important',
  },
  mainChartSelect: {
    padding: 10,
    paddingRight: 25,
  },
  mainChartLegentElement: {
    fontSize: '18px !important',
    marginLeft: theme.spacing(1),
  },
  mainHeader: {
    display: 'flex',
    margin: '10px',
    alignItems: 'center',
    justifyContent: 'center',
    // border: '2px solid blue',
  },
  mainTitle: {
    // color: theme.palette.primary.main,
    fontSize: '2rem !important',
  },
  dataGridContainer: {
    margin: '10px',
  },
  actionButton: {
    fontSize: '12px !important',
    height: '25px',
  },
  root: {
    '& .super-app-theme--cell': {
      margin: '0 0 0 10px',
    },
    '& .MuiDataGrid-footerContainer': {
      justifyContent: 'center',
    },
  },
  modalActionContainer: {
    // position: 'absolute',
    border: '1px solid red',
    width: '90%',
    margin: '20px',
    bottom: 20,
    diplay: 'flex !important',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));
