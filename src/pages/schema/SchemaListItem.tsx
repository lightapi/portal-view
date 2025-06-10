// this is a component to render an item in the BlogList component.
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import React from 'react';
import { Link } from 'react-router-dom';
import useStyles from './styles';

export default function SchemaListItem(props) {
  const classes = useStyles();
  console.log(props);
  const { data } = props;
  const toReadPage = {
    pathname: `/app/schema/${data.host}/${data.id}`,
    state: {
      isFrom: 'schemas',
    },
  };

  return (
    <div className={classes.itemWrapper}>
      <TableContainer component={Paper}>
        <Table size="small" aria-label="table">
          <TableRow className={classes.title}>
            <h2>
              <Link to={toReadPage}>{data.name}</Link>
            </h2>
          </TableRow>
          <TableRow className={classes.root}>
            {data.description.length > 300 ? (
              <span>
                {data.description.slice(0, 300) + ' ... '}
                <span className={classes.readMoreLink}>
                  <Link to={toReadPage}>Read More</Link>
                </span>
              </span>
            ) : (
              <span>
                {data.description + ' '} &nbsp;
                <span className={classes.readMoreLink}>
                  <Link to={toReadPage}>Read More</Link>
                </span>
              </span>
            )}
          </TableRow>
          <TableRow className={classes.root}>
            <TableCell align="left">
              <TagGroup tags={data.tags} />
            </TableCell>
          </TableRow>
        </Table>
      </TableContainer>
    </div>
  );
}

const TagGroup = ({ tags }) => (
  <div>
    {tags.map((tag) => {
      return <Button key={tag}>{tag}</Button>;
    })}
  </div>
);
