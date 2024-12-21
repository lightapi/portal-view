import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import { useNavigate } from 'react-router-dom';

const useRowStyles = makeStyles({
  root: {
    '& > *': {
      borderBottom: 'unset',
    },
  },
});

function Row(props) {
  //console.log(props);
  const { row, navigate } = props;
  const classes = useRowStyles();

  const handleValue = (tableId) => {
    navigate({
      pathname: '/app/ref/value',
      state: { data: { tableId } },
    });
  };

  const handleUpdate = (row) => {
    navigate({
      pathname: '/app/form/updateRefTable',
      state: { data: row },
    });
  };

  const handleDelete = (tableId) => {
    if (window.confirm('Are you sure you want to delete the table?')) {
        navigate({
        pathname: '/app/ref/deleteTable',
        state: { data: { tableId } },
      });
    }
  };

  return (
    <TableRow className={classes.root}>
      <TableCell align="left">{row.hostId}</TableCell>
      <TableCell align="left">{row.tableId}</TableCell>
      <TableCell align="left">{row.tableName}</TableCell>
      <TableCell align="left">{row.tableDesc}</TableCell>
      <TableCell align="left">{row.active}</TableCell>
      <TableCell align="left">{row.editable}</TableCell>
      <TableCell align="left">{row.common}</TableCell>
      <TableCell align="right">
        <AccountTreeIcon onClick={() => handleValue(row.tableId)} />
      </TableCell>
      <TableCell align="right">
        <SystemUpdateIcon onClick={() => handleUpdate(row)} />
      </TableCell>
      <TableCell align="right">
        <DeleteForeverIcon onClick={() => handleDelete(row.tableId)} />
      </TableCell>
    </TableRow>
  );
}

export default function TableList(props) {
  const { tables } = props;
  const navigate = useNavigate();
  return (
    <TableBody>
    {props.tables.map((table, index) => (
        <Row key={index} row={table} navigate={navigate} />
    ))}
    </TableBody>
  );
}
