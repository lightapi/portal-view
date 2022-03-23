import classnames from 'classnames';
import React from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import NotificationDetail from '../../components/Notification/NotificationDetail';
// context
import { useLayoutState } from '../../context/LayoutContext';
import BlogAdmin from '../../pages/blog/BlogAdmin';
import BlogDelete from '../../pages/blog/BlogDelete';
import BlogItem from '../../pages/blog/BlogItem';
import BlogList from '../../pages/blog/BlogList';
import Category from '../../pages/category/Category';
import CategoryDelete from '../../pages/category/CategoryDelete';
import Properties from '../../pages/config/Properties';
import GlobalValues from '../../pages/config/GlobalValues';
import GlobalFiles from '../../pages/config/GlobalFiles';
import GlobalFileUpload from '../../pages/config/GlobalFileUpload';
import GlobalFileUpdate from '../../pages/config/GlobalFileUpdate';
import GlobalFileDelete from '../../pages/config/GlobalFileDelete';
import GlobalCerts from '../../pages/config/GlobalCerts';
import GlobalCertUpload from '../../pages/config/GlobalCertUpload';
import GlobalCertUpdate from '../../pages/config/GlobalCertUpdate';
import GlobalCertDelete from '../../pages/config/GlobalCertDelete';
import Services from '../../pages/config/Services';
import ServiceFiles from '../../pages/config/ServiceFiles';
import ServiceFileUpload from '../../pages/config/ServiceFileUpload';
import ServiceFileUpdate from '../../pages/config/ServiceFileUpdate';
import ServiceFileDelete from '../../pages/config/ServiceFileDelete';
import ServiceCerts from '../../pages/config/ServiceCerts';
import ServiceCertUpload from '../../pages/config/ServiceCertUpload';
import ServiceCertUpdate from '../../pages/config/ServiceCertUpdate';
import ServiceCertDelete from '../../pages/config/ServiceCertDelete';
import ServiceProperties from '../../pages/config/ServiceProperties';
import DeleteProperty from '../../pages/config/DeleteProperty';
import GlobalValueDelete from '../../pages/config/GlobalValueDelete';
import DeleteService from '../../pages/config/DeleteService';
import DeleteServiceProperty from '../../pages/config/DeleteServiceProperty';
import CtrlPaneDashboard from '../../pages/controller/CtrlPaneDashboard';
import HealthCheck from '../../pages/controller/HealthCheck';
import ServerInfo from '../../pages/controller/ServerInfo';
import Logger from '../../pages/controller/Logger';
import LogViewer from '../../pages/controller/LogViewer';
import LoggerConfig from '../../pages/controller/LoggerConfig';
import LogContent from '../../pages/controller/LogContent';
import ChaosMonkey from '../../pages/controller/ChaosMonkey';
import CityProfile from '../../pages/covid/CityProfile';
import CityRegistry from '../../pages/covid/CityRegistry';
import DeleteCity from '../../pages/covid/DeleteCity';
import LiveMap from '../../pages/covid/LiveMap';
import Publish from '../../pages/covid/Publish';
import Status from '../../pages/covid/Status';
import UserId from '../../pages/covid/UserId';
import PeerStatus from '../../pages/covid/UserIdStatus';
import Website from '../../pages/covid/UserIdWebsite';
// pages
import Dashboard from '../../pages/dashboard';
import DeleteEntity from '../../pages/entity/DeleteEntity';
import EntityProfile from '../../pages/entity/EntityProfile';
import ErrorAdmin from '../../pages/error/ErrorAdmin';
import ErrorDelete from '../../pages/error/ErrorDelete';
import ErrorItem from '../../pages/error/ErrorItem';
import Failure from '../../pages/failure';
import Notifications from '../../pages/notifications';
import Client from '../../pages/oauth/Client';
import ClientDelete from '../../pages/oauth/ClientDelete';
import RefreshToken from '../../pages/oauth/RefreshToken';
import RefreshTokenDelete from '../../pages/oauth/RefreshTokenDelete';
import RefreshTokenDetail from '../../pages/oauth/RefreshTokenDetail';
import Profile from '../../pages/profile';
import DeletePayment from '../../pages/profile/DeletePayment';
import DeleteProfile from '../../pages/profile/DeleteProfile';
import MerchantOrders from '../../pages/profile/MerchantOrders';
import Payment from '../../pages/profile/Payment';
import UpdateRoles from '../../pages/profile/UpdateRoles';
import UserOrders from '../../pages/profile/UserOrders';
import PublishApi from '../../pages/publish/PublishApi';
import LocaleDelete from '../../pages/ref/LocaleDelete';
import RefLocale from '../../pages/ref/RefLocale';
import RefRelation from '../../pages/ref/RefRelation';
import RefRelaType from '../../pages/ref/RefRelaType';
import RefTable from '../../pages/ref/RefTable';
import RefValue from '../../pages/ref/RefValue';
import RelationDelete from '../../pages/ref/RelationDelete';
import RelationForm from '../../pages/ref/RelationForm';
import TableDelete from '../../pages/ref/TableDelete';
import TableForm from '../../pages/ref/TableForm';
import ValueDelete from '../../pages/ref/ValueDelete';
import ValueForm from '../../pages/ref/ValueForm';
import RuleAdmin from '../../pages/rule/RuleAdmin';
import RuleDelete from '../../pages/rule/RuleDelete';
import RuleItem from '../../pages/rule/RuleItem';
import RuleList from '../../pages/rule/RuleList';
import SchemaAdmin from '../../pages/schema/SchemaAdmin';
import SchemaDelete from '../../pages/schema/SchemaDelete';
import SchemaItem from '../../pages/schema/SchemaItem';
import SchemaList from '../../pages/schema/SchemaList';
import GraphqlEditor from '../../pages/service/GraphqlEditor';
import HybridEditor from '../../pages/service/HybridEditor';
import OpenapiEditor from '../../pages/service/OpenapiEditor';
import Service from '../../pages/service/Service';
import ServiceDelete from '../../pages/service/ServiceDelete';
import ServiceDetail from '../../pages/service/ServiceDetail';
import ServiceEndpoint from '../../pages/service/ServiceEndpoint';
import SubmitSpec from '../../pages/service/SubmitSpec';

// host
import HostDashboard from '../../pages/host/HostDashboard';

import Success from '../../pages/success';
import Form from '../Form/Form';
// components
import Header from '../Header';
import Messages from '../Notification/Messages';
import Sidebar from '../Sidebar';
// styles
import useStyles from './styles';

function Layout(props) {
  var classes = useStyles();

  // global
  var layoutState = useLayoutState();

  return (
    <div className={classes.root}>
      <>
        <Header history={props.history} />
        <Sidebar />
        <div
          className={classnames(classes.content, {
            [classes.contentShift]: layoutState.isSidebarOpened,
          })}
        >
          <div className={classes.fakeToolbar} />
          <Switch>
            <Route path="/app/dashboard" component={Dashboard} />
            <Route exact path="/app/form/:formId" component={Form} />
            <Route path="/app/notifications" component={Notifications} />
            <Route path="/app/failure" component={Failure} />
            <Route path="/app/success" component={Success} />
            <Route path="/app/profile" component={Profile} />
            <Route path="/app/payment" component={Payment} />
            <Route path="/app/updateRoles" component={UpdateRoles} />
            <Route path="/app/deleteProfile" component={DeleteProfile} />
            <Route path="/app/deletePayment" component={DeletePayment} />
            <Route
              path="/app/notificationDetail"
              component={NotificationDetail}
            />
            <Route path="/app/messages" component={Messages} />
            <Route path="/app/merchantOrders" component={MerchantOrders} />
            <Route path="/app/userOrders" component={UserOrders} />
            <Route path="/app/publishApi" component={PublishApi} />

            <Route path="/app/service/:style" component={Service} />
            <Route path="/app/service" component={Service} />
            <Route path="/app/deleteService" component={ServiceDelete} />
            <Route path="/app/serviceDetail" component={ServiceDetail} />
            <Route path="/app/openapiEditor" component={OpenapiEditor} />
            <Route path="/app/hybridEditor" component={HybridEditor} />
            <Route path="/app/graphqlEditor" component={GraphqlEditor} />
            <Route path="/app/submitSpec" component={SubmitSpec} />
            <Route path="/app/serviceEndpoint" component={ServiceEndpoint} />

            <Route path="/app/client" component={Client} />
            <Route path="/app/refreshToken" component={RefreshToken} />
            <Route
              path="/app/deleteRefreshToken"
              component={RefreshTokenDelete}
            />
            <Route
              path="/app/refreshTokenDetail"
              component={RefreshTokenDetail}
            />

            <Route path="/app/ref/table" component={RefTable} />
            <Route path="/app/ref/deleteTable" component={TableDelete} />
            <Route path="/app/ref/tableForm" component={TableForm} />
            <Route path="/app/ref/value" component={RefValue} />
            <Route path="/app/ref/deleteValue" component={ValueDelete} />
            <Route path="/app/ref/valueForm" component={ValueForm} />
            <Route path="/app/ref/locale" component={RefLocale} />
            <Route path="/app/ref/deleteLocale" component={LocaleDelete} />
            <Route path="/app/ref/relaType" component={RefRelaType} />
            <Route path="/app/ref/relation" component={RefRelation} />
            <Route path="/app/ref/relationForm" component={RelationForm} />
            <Route path="/app/ref/deleteRelation" component={RelationDelete} />

            <Route path="/app/oauth/client" component={Client} />
            <Route path="/app/oauth/deleteClient" component={ClientDelete} />

            <Route path="/app/category/list" component={Category} />
            <Route
              path="/app/category/deleteCategory"
              component={CategoryDelete}
            />

            <Route path="/app/blog/adminList" component={BlogAdmin} />
            <Route path="/app/blog/deleteBlog" component={BlogDelete} />
            <Route path="/app/blog/blogList" component={BlogList} />
            <Route path="/app/blog/:host/:id" component={BlogItem} />

            <Route path="/app/error/adminList" component={ErrorAdmin} />
            <Route path="/app/error/deleteBlog" component={ErrorDelete} />
            <Route path="/app/error/:host/:errorCode" component={ErrorItem} />

            <Route path="/app/schema/adminList" component={SchemaAdmin} />
            <Route path="/app/schema/deleteSchema" component={SchemaDelete} />
            <Route path="/app/schema/schemaList" component={SchemaList} />
            <Route path="/app/schema/:host/:id" component={SchemaItem} />

            <Route path="/app/rule/adminList" component={RuleAdmin} />
            <Route path="/app/rule/deleteRule" component={RuleDelete} />
            <Route path="/app/rule/ruleList" component={RuleList} />
            <Route path="/app/rule/:host/:id" component={RuleItem} />

            <Route path="/app/covid/cityRegistry" component={CityRegistry} />
            <Route path="/app/covid/cityProfile" component={CityProfile} />
            <Route path="/app/covid/deleteCity" component={DeleteCity} />
            <Route path="/app/covid/entity" component={EntityProfile} />
            <Route path="/app/covid/deleteEntity" component={DeleteEntity} />
            <Route path="/app/covid/map" component={LiveMap} />
            <Route path="/app/covid/status" component={Status} />
            <Route path="/app/covid/publish" component={Publish} />
            <Route path="/app/covid/peerStatus" component={PeerStatus} />
            <Route path="/app/covid/userId" component={UserId} />

            <Route path="/app/website" component={Website} />

            <Route path="/app/config/properties" component={Properties} />
            <Route path="/app/config/globalValues" component={GlobalValues} />
            <Route path="/app/config/globalValueDelete" component={GlobalValueDelete} />
            <Route path="/app/config/globalFiles" component={GlobalFiles} />
            <Route path="/app/config/globalFileUpload" component={GlobalFileUpload} />
            <Route path="/app/config/globalFileUpdate" component={GlobalFileUpdate} />
            <Route path="/app/config/globalFileDelete" component={GlobalFileDelete} />
            <Route path="/app/config/globalCerts" component={GlobalCerts} />
            <Route path="/app/config/globalCertUpload" component={GlobalCertUpload} />
            <Route path="/app/config/globalCertUpdate" component={GlobalCertUpdate} />
            <Route path="/app/config/globalCertDelete" component={GlobalCertDelete} />
            <Route path="/app/config/services" component={Services} />
            <Route path="/app/config/serviceFiles" component={ServiceFiles} />
            <Route path="/app/config/serviceFileUpload" component={ServiceFileUpload} />
            <Route path="/app/config/serviceFileUpdate" component={ServiceFileUpdate} />
            <Route path="/app/config/serviceFileDelete" component={ServiceFileDelete} />
            <Route path="/app/config/serviceCerts" component={ServiceCerts} />
            <Route path="/app/config/serviceCertUpload" component={ServiceCertUpload} />
            <Route path="/app/config/serviceCertUpdate" component={ServiceCertUpdate} />
            <Route path="/app/config/serviceCertDelete" component={ServiceCertDelete} />
            <Route path="/app/config/serviceProperties" component={ServiceProperties} />
            <Route path="/app/config/deleteProperty" component={DeleteProperty} />
            <Route path="/app/config/deleteService" component={DeleteService} />
            <Route path="/app/config/deleteServiceProperty" component={DeleteServiceProperty} />
            <Route path="/app/controller/services" component={CtrlPaneDashboard} />
            <Route path="/app/controller/check" component={HealthCheck} />
            <Route path="/app/controller/info" component={ServerInfo} />
            <Route path="/app/controller/logger" component={LogViewer} />
            <Route path="/app/controller/logViewer" component={LogViewer} />
            <Route path="/app/controller/loggerConfig" component={LoggerConfig} />
            <Route path="/app/controller/logContent" component={LogContent} />
            <Route path="/app/controller/chaos" component={ChaosMonkey} />

            <Route path="/app/host/dashboard" component={HostDashboard} />

            <Route
              exact
              path="/app/ui"
              render={() => <Redirect to="/app/ui/icons" />}
            />
          </Switch>
        </div>
      </>
    </div>
  );
}

export default withRouter(Layout);
