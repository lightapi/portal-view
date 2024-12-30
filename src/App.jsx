import React from 'react';
import {
  BrowserRouter,
  Routes,
  Navigate,
  Route,
} from 'react-router-dom';
import Layout from './components/Layout';
import Error from './pages/error';
import Dashboard from './pages/dashboard/Dashboard';
import BlogList from './pages/blog/BlogList';
import Form from './components/Form/Form';
import Notifications from './pages/notifications/Notifications';
import Failure from './pages/failure/Failure';
import Success from './pages/success/Success';
import Profile from './pages/profile/Profile';
import Payment from './pages/profile/Payment';
import UpdateRoles from './pages/profile/UpdateRoles';
import DeleteProfile from './pages/profile/DeleteProfile';
import DeletePayment from './pages/profile/DeletePayment';
import NotificationDetail from './components/Notification/NotificationDetail';
import Messages from './components/Notification/Messages';
import MerchantOrders from './pages/profile/MerchantOrders';
import UserOrders from './pages/profile/UserOrders';
import PublishApi from './pages/publish/PublishApi';
import Service from './pages/service/Service';
import ServiceDelete from './pages/service/ServiceDelete';
import ServiceDetail from './pages/service/ServiceDetail';
import OpenapiEditor from './pages/service/OpenapiEditor';
import HybridEditor from './pages/service/HybridEditor';
import GraphqlEditor from './pages/service/GraphqlEditor';
import SubmitSpec from './pages/service/SubmitSpec';
import ServiceEndpoint from './pages/service/ServiceEndpoint';
import Client from './pages/oauth/Client';
import RefreshToken from './pages/oauth/RefreshToken';
import RefreshTokenDelete from './pages/oauth/RefreshTokenDelete';
import RefreshTokenDetail from './pages/oauth/RefreshTokenDetail';
import RefTable from './pages/ref/RefTable';
import TableDelete from './pages/ref/TableDelete';
import TableForm from './pages/ref/TableForm';
import RefValue from './pages/ref/RefValue';
import ValueDelete from './pages/ref/ValueDelete';
import ValueForm from './pages/ref/ValueForm';
import RefLocale from './pages/ref/RefLocale';
import LocaleDelete from './pages/ref/LocaleDelete';
import RefRelaType from './pages/ref/RefRelaType';
import RefRelation from './pages/ref/RefRelation';
import RelationForm from './pages/ref/RelationForm';
import RelationDelete from './pages/ref/RelationDelete';
import ClientDelete from './pages/oauth/ClientDelete';
import Category from './pages/category/Category';
import CategoryDelete from './pages/category/CategoryDelete';
import BlogAdmin from './pages/blog/BlogAdmin';
import BlogDelete from './pages/blog/BlogDelete';
import BlogItem from './pages/blog/BlogItem';
import ErrorAdmin from './pages/error/ErrorAdmin';
import ErrorDelete from './pages/error/ErrorDelete';
import ErrorItem from './pages/error/ErrorItem';
import SchemaAdmin from './pages/schema/SchemaAdmin';
import SchemaDelete from './pages/schema/SchemaDelete';
import SchemaList from './pages/schema/SchemaList';
import SchemaItem from './pages/schema/SchemaItem';
import RuleAdmin from './pages/rule/RuleAdmin';
import RuleDelete from './pages/rule/RuleDelete';
import RuleList from './pages/rule/RuleList';
import RuleItem from './pages/rule/RuleItem';
import CityRegistry from './pages/covid/CityRegistry';
import CityProfile from './pages/covid/CityProfile';
import DeleteCity from './pages/covid/DeleteCity';
import EntityProfile from './pages/entity/EntityProfile';
import DeleteEntity from './pages/entity/DeleteEntity';
import LiveMap from './pages/covid/LiveMap';
import Status from './pages/covid/Status';
import Publish from './pages/covid/Publish';
import PeerStatus from './pages/covid/UserIdStatus';
import UserId from './pages/covid/UserId';
import Website from './pages/covid/UserIdWebsite';
import Properties from './pages/config/Properties';
import GlobalValues from './pages/config/GlobalValues';
import GlobalValueDelete from './pages/config/GlobalValueDelete';
import GlobalFiles from './pages/config/GlobalFiles';
import GlobalFileUpload from './pages/config/GlobalFileUpload';
import GlobalFileUpdate from './pages/config/GlobalFileUpdate';
import GlobalFileDelete from './pages/config/GlobalFileDelete';
import GlobalCerts from './pages/config/GlobalCerts';
import GlobalCertUpload from './pages/config/GlobalCertUpload';
import GlobalCertUpdate from './pages/config/GlobalCertUpdate';
import GlobalCertDelete from './pages/config/GlobalCertDelete';
import Services from './pages/config/Services';
import ServiceFiles from './pages/config/ServiceFiles';
import ServiceFileUpload from './pages/config/ServiceFileUpload';
import ServiceFileUpdate from './pages/config/ServiceFileUpdate';
import ServiceFileDelete from './pages/config/ServiceFileDelete';
import ServiceCerts from './pages/config/ServiceCerts';
import ServiceCertUpload from './pages/config/ServiceCertUpload';
import ServiceCertUpdate from './pages/config/ServiceCertUpdate';
import ServiceCertDelete from './pages/config/ServiceCertDelete';
import ServiceProperties from './pages/config/ServiceProperties';
import DeleteProperty from './pages/config/DeleteProperty';
import DeleteService from './pages/config/DeleteService';
import DeleteServiceProperty from './pages/config/DeleteServiceProperty';
import CtrlPaneDashboard from './pages/controller/CtrlPaneDashboard';
import HealthCheck from './pages/controller/HealthCheck';
import ServerInfo from './pages/controller/ServerInfo';
import LogViewer from './pages/controller/LogViewer';
import LoggerConfig from './pages/controller/LoggerConfig';
import LogContent from './pages/controller/LogContent';
import ChaosMonkey from './pages/controller/ChaosMonkey';
import HostDashboard from './pages/host/HostDashboard';

const App = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Redirect from root to dashboard */}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        
        {/* Layout routes */}
        <Route path="/app/*" element={<Layout />}>
        <Route path="dashboard" element={<Dashboard />} />
          <Route path="blog/blogList" element={<BlogList />} />
          <Route path="form/:formId" element={<Form />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="failure" element={<Failure />} />
          <Route path="success" element={<Success />} />
          <Route path="profile" element={<Profile />} />
          <Route path="payment" element={<Payment />} />
          <Route path="updateRoles" element={<UpdateRoles />} />
          <Route path="deleteProfile" element={<DeleteProfile />} />
          <Route path="deletePayment" element={<DeletePayment />} />
          <Route path="notificationDetail" element={<NotificationDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="merchantOrders" element={<MerchantOrders />} />
          <Route path="userOrders" element={<UserOrders />} />
          <Route path="publishApi" element={<PublishApi />} />
          <Route path="service/:apiType" element={<Service />} />
          <Route path="service/admin" element={<Service />} />
          <Route path="deleteService" element={<ServiceDelete />} />
          <Route path="serviceDetail" element={<ServiceDetail />} />
          <Route path="openapiEditor" element={<OpenapiEditor />} />
          <Route path="hybridEditor" element={<HybridEditor />} />
          <Route path="graphqlEditor" element={<GraphqlEditor />} />
          <Route path="submitSpec" element={<SubmitSpec />} />
          <Route path="serviceEndpoint" element={<ServiceEndpoint />} />
          <Route path="client" element={<Client />} />
          <Route path="refreshToken" element={<RefreshToken />} />
          <Route path="deleteRefreshToken" element={<RefreshTokenDelete />} />
          <Route path="refreshTokenDetail" element={<RefreshTokenDetail />} />
          <Route path="ref/table" element={<RefTable />} />
          <Route path="ref/deleteTable" element={<TableDelete />} />
          <Route path="ref/tableForm" element={<TableForm />} />
          <Route path="ref/value" element={<RefValue />} />
          <Route path="ref/deleteValue" element={<ValueDelete />} />
          <Route path="ref/valueForm" element={<ValueForm />} />
          <Route path="ref/locale" element={<RefLocale />} />
          <Route path="ref/deleteLocale" element={<LocaleDelete />} />
          <Route path="ref/relaType" element={<RefRelaType />} />
          <Route path="ref/relation" element={<RefRelation />} />
          <Route path="ref/relationForm" element={<RelationForm />} />
          <Route path="ref/deleteRelation" element={<RelationDelete />} />
          <Route path="oauth/client" element={<Client />} />
          <Route path="oauth/deleteClient" element={<ClientDelete />} />
          <Route path="category/list" element={<Category />} />
          <Route path="category/deleteCategory" element={<CategoryDelete />} />
          <Route path="blog/adminList" element={<BlogAdmin />} />
          <Route path="blog/deleteBlog" element={<BlogDelete />} />
          <Route path="blog/:host/:id" element={<BlogItem />} />
          <Route path="error/adminList" element={<ErrorAdmin />} />
          <Route path="error/deleteBlog" element={<ErrorDelete />} />
          <Route path="error/:host/:errorCode" element={<ErrorItem />} />
          <Route path="schema/adminList" element={<SchemaAdmin />} />
          <Route path="schema/deleteSchema" element={<SchemaDelete />} />
          <Route path="schema/schemaList" element={<SchemaList />} />
          <Route path="schema/:host/:id" element={<SchemaItem />} />
          <Route path="rule/admin" element={<RuleAdmin />} />
          <Route path="rule/deleteRule" element={<RuleDelete />} />
          <Route path="rule/ruleList" element={<RuleList />} />
          <Route path="rule/:host/:id" element={<RuleItem />} />
          <Route path="covid/cityRegistry" element={<CityRegistry />} />
          <Route path="covid/cityProfile" element={<CityProfile />} />
          <Route path="covid/deleteCity" element={<DeleteCity />} />
          <Route path="covid/entity" element={<EntityProfile />} />
          <Route path="covid/deleteEntity" element={<DeleteEntity />} />
          <Route path="covid/map" element={<LiveMap />} />
          <Route path="covid/status" element={<Status />} />
          <Route path="covid/publish" element={<Publish />} />
          <Route path="covid/peerStatus" element={<PeerStatus />} />
          <Route path="covid/userId" element={<UserId />} />
          <Route path="website" element={<Website />} />
          <Route path="config/properties" element={<Properties />} />
          <Route path="config/globalValues" element={<GlobalValues />} />
          <Route path="config/globalValueDelete" element={<GlobalValueDelete />} />
          <Route path="config/globalFiles" element={<GlobalFiles />} />
          <Route path="config/globalFileUpload" element={<GlobalFileUpload />} />
          <Route path="config/globalFileUpdate" element={<GlobalFileUpdate />} />
          <Route path="config/globalFileDelete" element={<GlobalFileDelete />} />
          <Route path="config/globalCerts" element={<GlobalCerts />} />
          <Route path="config/globalCertUpload" element={<GlobalCertUpload />} />
          <Route path="config/globalCertUpdate" element={<GlobalCertUpdate />} />
          <Route path="config/globalCertDelete" element={<GlobalCertDelete />} />
          <Route path="config/services" element={<Services />} />
          <Route path="config/serviceFiles" element={<ServiceFiles />} />
          <Route path="config/serviceFileUpload" element={<ServiceFileUpload />} />
          <Route path="config/serviceFileUpdate" element={<ServiceFileUpdate />} />
          <Route path="config/serviceFileDelete" element={<ServiceFileDelete />} />
          <Route path="config/serviceCerts" element={<ServiceCerts />} />
          <Route path="config/serviceCertUpload" element={<ServiceCertUpload />} />
          <Route path="config/serviceCertUpdate" element={<ServiceCertUpdate />} />
          <Route path="config/serviceCertDelete" element={<ServiceCertDelete />} />
          <Route path="config/serviceProperties" element={<ServiceProperties />} />
          <Route path="config/deleteProperty" element={<DeleteProperty />} />
          <Route path="config/deleteService" element={<DeleteService />} />
          <Route path="config/deleteServiceProperty" element={<DeleteServiceProperty />} />
          <Route path="controller/services" element={<CtrlPaneDashboard />} />
          <Route path="controller/check" element={<HealthCheck />} />
          <Route path="controller/info" element={<ServerInfo />} />
          <Route path="controller/logger" element={<LogViewer />} />
          <Route path="controller/logViewer" element={<LogViewer />} />
          <Route path="controller/loggerConfig" element={<LoggerConfig />} />
          <Route path="controller/logContent" element={<LogContent />} />
          <Route path="controller/chaos" element={<ChaosMonkey />} />
          <Route path="host/dashboard" element={<HostDashboard />} />

        </Route>
        {/* Catch all route for 404 */}
        <Route path="*" element={<Error />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
