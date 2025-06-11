// this is a component to render an item in the BlogList component.
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeConversion, validateImageUrl } from '../../utils';
import useStyles from './styles';

export default function BlogListItem(props) {
  const classes = useStyles();
  console.log(props);
  const { data } = props;
  const [imageUrlValid, setImageUrlValid] = useState(false);

  useEffect(() => {
    // Create an scoped async function in the hook
    async function checkImageUrl() {
      await validateImageUrl(data.featuredImageUrl);
      setImageUrlValid(true);
    }
    // Execute the created function directly
    checkImageUrl();
  }, []);

  const toReadPage = {
    pathname: `/app/blog/${data.host}/${data.id}`,
    state: {
      isFrom: 'blogs',
    },
  };

  return (
    <div className={classes.itemWrapper}>
      {imageUrlValid ? (
        <div className={classes.imageWrapper}>
          <div
            className={classes.image}
            style={{ backgroundImage: `url(${data.featuredImageUrl})` }}
          />
        </div>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small" aria-label="table">
          <TableRow className={classes.title}>
            <h2>
              <Link to={toReadPage}>{data.title}</Link>
            </h2>
          </TableRow>
          <TableRow className={classes.infoWrapper}>
            <TableCell align="left">
              Posted by <span className={classes.author}>{data.author}</span>
            </TableCell>
            <TableCell align="right" className={classes.timeConversion}>
              {timeConversion(new Date().getTime() - data.publishDate)}
            </TableCell>
          </TableRow>
          <TableRow className={classes.root}>
            {data.summary.length > 300 ? (
              <span>
                {data.summary.slice(0, 300) + ' ... '}
                <span className={classes.readMoreLink}>
                  <Link to={toReadPage}>Read More</Link>
                </span>
              </span>
            ) : (
              <span>
                {data.summary + ' '} &nbsp;
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
