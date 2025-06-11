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

export default function RealEstate(props) {
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
                <TableRow>
                  <TableCell>Address:</TableCell>
                  <TableCell align="left">{subject.address}</TableCell>
                  <TableCell align="left">Postal Code:</TableCell>
                  <TableCell align="left">{subject.postalCode}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Price:</TableCell>
                  <TableCell align="left">{subject.price}</TableCell>
                  <TableCell align="left">Property Type:</TableCell>
                  <TableCell align="left">{subject.propertyType}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Community Name:</TableCell>
                  <TableCell align="left">{subject.communityName}</TableCell>
                  <TableCell align="left">Property Title:</TableCell>
                  <TableCell align="left">{subject.title}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Storeys:</TableCell>
                  <TableCell align="left">{subject.storeys}</TableCell>
                  <TableCell align="left">Land Size:</TableCell>
                  <TableCell align="left">{subject.landSize}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Above Grade Bedrooms:</TableCell>
                  <TableCell align="left">
                    {subject.aboveGradeBedrooms}
                  </TableCell>
                  <TableCell align="left">Below Grade Bedrooms:</TableCell>
                  <TableCell align="left">
                    {subject.belowGradeBedrooms}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Bathrooms:</TableCell>
                  <TableCell align="left">{subject.bathrooms}</TableCell>
                  <TableCell align="left">Basement Type:</TableCell>
                  <TableCell align="left">{subject.basementType}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Building Features:</TableCell>
                  <TableCell align="left">{subject.buildingFeatures}</TableCell>
                  <TableCell align="left">Building Style:</TableCell>
                  <TableCell align="left">{subject.buildingStyle}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Cooling:</TableCell>
                  <TableCell align="left">{subject.cooling}</TableCell>
                  <TableCell align="left">Heating:</TableCell>
                  <TableCell align="left">{subject.heating}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Exterior Finish:</TableCell>
                  <TableCell align="left">{subject.exteriorFinish}</TableCell>
                  <TableCell align="left">Amenities Nearby:</TableCell>
                  <TableCell align="left">{subject.amenitiesNearby}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Parking Type:</TableCell>
                  <TableCell align="left">{subject.parkingType}</TableCell>
                  <TableCell align="left">Total Parking Spaces:</TableCell>
                  <TableCell align="left">
                    {subject.totalParkingSpaces}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <br />
        </React.Fragment>
      ))}
    </div>
  );
}
