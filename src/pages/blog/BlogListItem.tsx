import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeConversion, validateImageUrl } from '../../utils';
import { useTheme } from '@mui/material/styles';

interface BlogListItemProps {
    data: {
        id: string;
        host: string;
        title: string;
        author: string;
        summary: string;
        publishDate: number;
        featuredImageUrl?: string;
        tags: string[];
    };
}

export default function BlogListItem({ data }: BlogListItemProps) {
  const theme = useTheme();
  const [imageUrlValid, setImageUrlValid] = useState(false);

  useEffect(() => {
    async function checkImageUrl() {
      if (data.featuredImageUrl) {
        try {
            await validateImageUrl(data.featuredImageUrl);
            setImageUrlValid(true);
        } catch (e) {
            setImageUrlValid(false);
        }
      }
    }
    checkImageUrl();
  }, [data.featuredImageUrl]);

  const toReadPage = {
    pathname: `/app/blog/${data.host}/${data.id}`,
    state: {
      isFrom: 'blogs',
    },
  };

  return (
    <Box sx={{ display: 'flex', mb: 3, p: 2, borderBottom: '1px solid #eee' }}>
      {imageUrlValid && (
        <Box sx={{ mr: 4, flexShrink: 0 }}>
          <Box
            sx={{
              height: 200,
              width: 200,
              backgroundImage: `url(${data.featuredImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 2,
            }}
          />
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          <Link to={toReadPage} style={{ textDecoration: 'none', color: theme.palette.primary.main }}>
            {data.title}
          </Link>
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, color: 'text.secondary' }}>
          <Typography variant="body2">
            Posted by <Box component="span" sx={{ fontWeight: 600 }}>{data.author}</Box>
          </Typography>
          <Typography variant="body2">
            {timeConversion(new Date().getTime() - data.publishDate)}
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 2 }}>
            {data.summary.length > 300 ? (
                <>
                    {data.summary.slice(0, 300) + ' ... '}
                    <Link to={toReadPage} style={{ color: theme.palette.secondary.main }}>Read More</Link>
                </>
            ) : (
                <>
                    {data.summary + ' '}
                    <Link to={toReadPage} style={{ color: theme.palette.secondary.main }}>Read More</Link>
                </>
            )}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.tags.map((tag) => (
            <Button key={tag} size="small" variant="outlined" sx={{ borderRadius: 4 }}>
              {tag}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
