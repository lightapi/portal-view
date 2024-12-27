import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import React, { useEffect } from 'react';
import Cookies from 'universal-cookie';
import PageTitle from '../../components/PageTitle/PageTitle';
import Dot from '../../components/Sidebar/components/Dot';
// components
import Widget from '../../components/Widget/Widget';
import { Typography } from '../../components/Wrappers/Wrappers';
import { useUserDispatch, useUserState } from '../../contexts/UserContext';
import useStyles from './styles';

export default function Dashboard(props) {
  var classes = useStyles();
  /*
  // can not remember why we need to query user profile here
  const { email } = useUserState();
  const userDispatch = useUserDispatch();
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'queryUserByEmail',
    version: '0.1.0',
    data: { email },
  };
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const cookies = new Cookies();
        Object.assign(headers, { 'X-CSRF-TOKEN': cookies.get('csrf') });
        const response = await fetch(url, {
          headers,
          credentials: 'include',
          signal: abortController.signal,
        });
        //console.log(response);
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        //console.log(data);
        userDispatch({
          type: 'UPDATE_PROFILE',
          userId: data.userId,
          host: data.host,
        });
      } catch (e) {
        // only call dispatch when we know the fetch was not aborted
        if (!abortController.signal.aborted) {
          const error = await e.json();
          console.log(error);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);
  */
  return (
    <>
      <Box className={classes.mainHeader}>
        <Typography className={classes.mainTitle}>Light Portal</Typography>
      </Box>
      <PageTitle title="Bring the API producers and consumers together." />
      <Box className={classes.buttonHeader}>
        <Button variant="contained" color="secondary" size="large">
          Latest News
        </Button>
      </Box>
      <Grid container spacing={4}>
        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Share Knowledge"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                For new developers, you can find a lot of examples here to learn
                how to use the light-platform.
              </Typography>
            </div>
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                For experienced contributors, you can share your knowledge and
                your work to others.
              </Typography>
            </div>
          </Widget>
        </Grid>

        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Marketplace"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                Build APIs with light-platform and publish your APIs in the
                marketplace to allow others to use them.
              </Typography>
            </div>
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                We host APIs and single page applications for contributors with
                no charge or a small fee to cover the cost.
              </Typography>
            </div>
          </Widget>
        </Grid>
        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Security"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                Light-oauth2 is behind the portal, and it is responsible for
                security. All applications can use light-portal for protection.
              </Typography>
            </div>
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                As users are shared between sites, single sign-on is supported
                natively. Your users won't need to register on your site again.
              </Typography>
            </div>
          </Widget>
        </Grid>
        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Service"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                We provide other infrastructure services for your
                microservices—for example, metrics, distributed tracing,
                logging, etc.
              </Typography>
            </div>
            <div className={classes.serverOverviewElement}>
              <Typography
                color="text"
                colorBrightness="secondary"
                className={classes.serverOverviewElementText}
              >
                Your application can leverage other people's services directly
                without reinventing the wheel.
              </Typography>
            </div>
          </Widget>
        </Grid>
        <Grid item xs={12}>
          <Widget bodyClass={classes.mainChartBody}>
            <div className={classes.performanceLegendWrapper}>
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
            </div>
          </Widget>
        </Grid>

        <Grid item lg={3} md={4} sm={6} xs={12}>
          <Widget
            title="Youtube Channel"
            upperTitle
            bodyClass={classes.fullHeightBody}
            className={classes.card}
          >
            <Grid container spacing={2}>
              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link
                        href="https://www.youtube.com/channel/UCHCRMWJVXw8iB7zKxF55Byw"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Demo Video
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>
            </Grid>
          </Widget>
        </Grid>

        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Open Source"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <Grid container spacing={2}>
              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link
                        href="https://github.com/networknt/portal-view"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Portal-view
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>
              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link
                        href="https://github.com/networknt"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Light Platform
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>
            </Grid>
          </Widget>
        </Grid>

        <Grid item lg={3} md={8} sm={6} xs={12}>
          <Widget
            title="Document"
            upperTitle
            className={classes.card}
            bodyClass={classes.fullHeightBody}
          >
            <Grid container spacing={2}>
              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link
                        href="https://doc.networknt.com/"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Documentation
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>
            </Grid>
          </Widget>
        </Grid>
        <Grid item lg={3} md={4} sm={6} xs={12}>
          <Widget title="Contact" upperTitle className={classes.card}>
            <Grid container spacing={2}>
              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link href="mailto:stevehu@gmail.com" target="_top">
                        Send Mail
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>

              <div className={classes.performanceLegendWrapper}>
                <Grid item xs={12}>
                  <div className={classes.legendElement}>
                    <Dot color="primary" />
                    <Typography
                      color="text"
                      colorBrightness="secondary"
                      className={classes.legendElementText}
                    >
                      <Link
                        href="https://gitter.im/networknt/light-portal"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        Gitter Chat
                      </Link>
                    </Typography>
                  </div>
                </Grid>
              </div>
            </Grid>
          </Widget>
        </Grid>
      </Grid>
    </>
  );
}
