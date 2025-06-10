import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import React from 'react';
import ImagePopup from './ImagePopup';
import VideoList from './VideoList';

const useStyles = makeStyles({
  table: {
    minWidth: 700,
  },
});

export default function Common(props) {
  const classes = useStyles();
  return (
    <div>
      {props.site.ss.map((subject, index) => (
        <React.Fragment key={index}>
          <TableContainer component={Paper}>
            <Table className={classes.table} aria-label="spanning table">
              <TableBody>
                <TableRow>
                  <TableCell>From:</TableCell>
                  <TableCell align="left">{props.userId}</TableCell>
                  <TableCell align="left">Date:</TableCell>
                  <TableCell align="left">{subject.t}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} align="left">
                    {subject.s}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} align="left">
                    {subject.d}
                  </TableCell>
                </TableRow>
                {(subject.is && subject.is.length > 0) ||
                (subject.vs && subject.vs.length > 0) ? (
                  <TableRow>
                    <TableCell>Images:</TableCell>
                    <TableCell align="left">
                      {subject.is && subject.is.length > 0 ? (
                        <ImagePopup images={subject.is} />
                      ) : null}
                    </TableCell>
                    <TableCell align="left">Videos:</TableCell>
                    <TableCell align="left">
                      {subject.vs && subject.vs.length > 0 ? (
                        <VideoList vs={subject.vs} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
          <br />
        </React.Fragment>
      ))}
    </div>
  );
}
