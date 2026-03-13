import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import React, { useEffect, useRef } from 'react';
import PageTitle from '../../components/PageTitle/PageTitle';
import Dot from '../../components/Sidebar/components/Dot';
import Widget from '../../components/Widget/Widget';
import { Typography } from '../../components/Wrappers/Wrappers';
import { useUserDispatch, signOut } from '../../contexts/UserContext';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const userDispatch = useUserDispatch();
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const state = searchParams.get('state');

    if (state && !verificationAttempted.current) {
      verificationAttempted.current = true;
      const storedState = localStorage.getItem('portal_auth_state');
      if (storedState === state) {
        console.log('OAuth state verified successfully.');
        localStorage.removeItem('portal_auth_state');
        const newSearchParams = new URLSearchParams(location.search);
        newSearchParams.delete('state');
        navigate({ search: newSearchParams.toString() }, { replace: true });
      } else {
        console.error('OAuth state mismatch. Potential CSRF attack.');
        alert('OAuth state mismatch. Potential CSRF attack. Logging out...');
        signOut(userDispatch as any, navigate);
      }
    }
  }, [location, navigate, userDispatch]);

  return (
    <>
      <Box sx={{ display: 'flex', mt: '70px', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'primary.main', fontSize: '4rem' }}>Light Portal</Typography>
      </Box>
      <PageTitle title="Bring the API producers and consumers together." />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pb: '60px' }}>
        <Button variant="contained" color="secondary" size="large">
          Latest News
        </Button>
      </Box>
      <Grid container spacing={4}>
        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Share Knowledge"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodyClass="fullHeightBody"
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                For new developers, you can find a lot of examples here to learn
                how to use the light-platform.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                For experienced contributors, you can share your knowledge and
                your work to others.
              </Typography>
            </Box>
          </Widget>
        </Grid>

        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Marketplace"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                Build APIs with light-platform and publish your APIs in the
                marketplace to allow others to use them.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                We host APIs and single page applications for contributors with
                no charge or a small fee to cover the cost.
              </Typography>
            </Box>
          </Widget>
        </Grid>
        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Security"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                Light-oauth2 is behind the portal, and it is responsible for
                security. All applications can use light-portal for protection.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                As users are shared between sites, single sign-on is supported
                natively. Your users won't need to register on your site again.
              </Typography>
            </Box>
          </Widget>
        </Grid>
        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Service"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                We provide other infrastructure services for your
                microservices—for example, metrics, distributed tracing,
                logging, etc.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
              <Typography
                color="text"
                colorBrightness="secondary"
                sx={{ minWidth: 145, pr: 2 }}
              >
                Your application can leverage other people's services directly
                without reinventing the wheel.
              </Typography>
            </Box>
          </Widget>
        </Grid>
        <Grid size={12}>
          <Widget bodySx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
              <div>
                As you might have realized, we have marked light-eventuate-4j,
                light-tram-4j, and light-saga-4j deprecated because they are
                replaced by light-kafak. And we are in the process of re-writing
                the light-portal services on it these days.
                <p />
                With Kafka 2.0 release, it supports transaction and exact once
                delivery as well as Kafka streams. We have developed a
                light-kafka module to leverage it for event sourcing and CQRS.
                Since then, we have been re-writing the light-portal based on
                it. The light-kafka is a commercial module that provides the
                integration with Kafka and Avro event serialization, and it will
                only be open-sourced for customers. It is a foundation for
                almost all applications built these days internally, including
                light-portal, taiji-blockchain, and maproot.net. Since the new
                light-portal is based on it, we cannot open source it as the key
                dependency is a commercial module. That is why we have made it a
                private repository that will be open-sourced to customers only.
                The portal-view is a react single page application, and it is
                opened sourced with MIT license.
                <p />
                The long term goal is to provide services to small and
                medium-sized customers as a cloud subscription service. At the
                same time, it can be sold as an enterprise edition for
                enterprise customers who want to deploy it within the
                organization. All commercial modules will be open-sourced to
                customers so that a team of users who have common interests can
                work together to improve the products.
                <p />I have double-checked the light-portal repository and
                haven't found any outside contributions. If you are using old
                light-portal modules, please let us know so that we can discuss
                how to migrate to the new version.
              </div>
            </Box>
          </Widget>
        </Grid>

        <Grid size={{ lg: 3, md: 4, sm: 6, xs: 12 }}>
          <Widget
            title="Youtube Channel"
            upperTitle
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <Grid container spacing={2}>
              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link
                        href="https://www.youtube.com/channel/UCHCRMWJVXw8iB7zKxF55Byw"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Demo Video
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>
            </Grid>
          </Widget>
        </Grid>

        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Open Source"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Grid container spacing={2}>
              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link
                        href="https://github.com/networknt/portal-view"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Portal-view
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>
              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link
                        href="https://github.com/networknt"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Light Platform
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>
            </Grid>
          </Widget>
        </Grid>

        <Grid size={{ lg: 3, md: 8, sm: 6, xs: 12 }}>
          <Widget
            title="Document"
            upperTitle
            sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            bodySx={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <Grid container spacing={2}>
              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link
                        href="https://doc.networknt.com/"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Documentation
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>
            </Grid>
          </Widget>
        </Grid>
        <Grid size={{ lg: 3, md: 4, sm: 6, xs: 12 }}>
          <Widget title="Contact" upperTitle sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <Grid container spacing={2}>
              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link href="mailto:stevehu@gmail.com" target="_top">
                        Send Mail
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>

              <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', mb: 1 }}>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, mt: '8px' }}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      sx={{ ml: 1 }}
                    >
                      <Link
                        href="https://gitter.im/networknt/light-portal"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Gitter Chat
                      </Link>
                    </Typography>
                  </Box>
                </Grid>
              </Box>
            </Grid>
          </Widget>
        </Grid>
      </Grid>
    </>
  );
}
