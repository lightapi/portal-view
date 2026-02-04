import { BrowserRouter, Routes, Navigate, Route, useLocation, useNavigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Error from "./pages/error";
import Dashboard from "./pages/dashboard/Dashboard";
import BlogList from "./pages/blog/BlogList";
import Form from "./components/Form/Form";
import Notification from "./pages/notification/Notification";
import Failure from "./pages/failure/Failure";
import Success from "./pages/success/Success";
import Profile from "./pages/profile/Profile";
import Payment from "./pages/profile/Payment";
import UpdateRoles from "./pages/profile/UpdateRoles";
import DeleteProfile from "./pages/profile/DeleteProfile";
import DeletePayment from "./pages/profile/DeletePayment";
import NotificationDetail from "./components/Notification/NotificationDetail";
import Messages from "./components/Notification/Messages";
import MerchantOrders from "./pages/profile/MerchantOrders";
import UserOrders from "./pages/profile/UserOrders";
import PublishApi from "./pages/publish/PublishApi";
import User from "./pages/user/User";
import UserHost from "./pages/user/UserHost";
import Service from "./pages/service/Service";
import ApiDetail from "./pages/service/ApiDetail";
import OpenapiEditor from "./pages/service/OpenapiEditor";
import HybridEditor from "./pages/service/HybridEditor";
import GraphqlEditor from "./pages/service/GraphqlEditor";
import ServiceEndpoint from "./pages/service/ServiceEndpoint";
import ListScope from "./pages/service/ListScope";
import ListRule from "./pages/service/ListRule";
import ClientApp from "./pages/client/ClientApp";
import AuthClient from "./pages/oauth/AuthClient";
import RefreshToken from "./pages/oauth/RefreshToken";
import AuthCode from "./pages/oauth/AuthCode";
import RefTableAdmin from "./pages/ref/RefTableAdmin";
import RefValue from "./pages/ref/RefValue";
import RefLocale from "./pages/ref/RefLocale";
import RelationTypeAdmin from "./pages/ref/RelationTypeAdmin";
import RefRelation from "./pages/ref/RefRelation";
import Category from "./pages/category/Category";
import TagAdmin from "./pages/tag/TagAdmin";
import BlogAdmin from "./pages/blog/BlogAdmin";
import BlogDelete from "./pages/blog/BlogDelete";
import BlogItem from "./pages/blog/BlogItem";
import ErrorAdmin from "./pages/error/ErrorAdmin";
import ErrorDelete from "./pages/error/ErrorDelete";
import ErrorItem from "./pages/error/ErrorItem";
import SchemaAdmin from "./pages/schema/SchemaAdmin";
import ScheduleAdmin from "./pages/schedule/ScheduleAdmin";
import RuleAdmin from "./pages/rule/RuleAdmin";
import CityRegistry from "./pages/covid/CityRegistry";
import CityProfile from "./pages/covid/CityProfile";
import DeleteCity from "./pages/covid/DeleteCity";
import EntityProfile from "./pages/entity/EntityProfile";
import DeleteEntity from "./pages/entity/DeleteEntity";
import LiveMap from "./pages/covid/LiveMap";
import Status from "./pages/covid/Status";
import Publish from "./pages/covid/Publish";
import PeerStatus from "./pages/covid/UserIdStatus";
import UserId from "./pages/covid/UserId";
import Website from "./pages/covid/UserIdWebsite";
import ConfigAdmin from "./pages/config/ConfigAdmin";
import ConfigProperty from "./pages/config/ConfigProperty";
import ConfigEnvironment from "./pages/config/ConfigEnvironment";
import ConfigProduct from "./pages/config/ConfigProduct";
import ConfigProductVersion from "./pages/config/ConfigProductVersion";
import ConfigInstance from "./pages/config/ConfigInstance";
import ConfigInstanceApi from "./pages/config/ConfigInstanceApi";
import ConfigInstanceApp from "./pages/config/ConfigInstanceApp";
import ConfigInstanceAppApi from "./pages/config/ConfigInstanceAppApi";
import ConfigInstanceFile from "./pages/config/ConfigInstanceFile";
import ConfigSnapshot from "./pages/snapshot/ConfigSnapshot";
import ConfigDeploymentInstance from "./pages/config/ConfigDeploymentInstance";
import CtrlPaneDashboard from "./pages/controller/CtrlPaneDashboard";
import HealthCheck from "./pages/controller/HealthCheck";
import ServerInfo from "./pages/controller/ServerInfo";
import LogViewer from "./pages/controller/LogViewer";
import LoggerConfig from "./pages/controller/LoggerConfig";
import LogContent from "./pages/controller/LogContent";
import ChaosMonkey from "./pages/controller/ChaosMonkey";
import OrgAdmin from "./pages/org/OrgAdmin";
import Host from "./pages/host/Host";
import HostAdmin from "./pages/host/HostAdmin";
import HostUser from "./pages/host/HostUser";
import RoleAdmin from "./pages/access/RoleAdmin";
import RoleUser from "./pages/access/RoleUser";
import RolePermission from "./pages/access/RolePermission";
import RoleRowFilter from "./pages/access/RoleRowFilter";
import RoleColFilter from "./pages/access/RoleColFilter";
import GroupAdmin from "./pages/access/GroupAdmin";
import GroupPermission from "./pages/access/GroupPermission";
import GroupUser from "./pages/access/GroupUser";
import GroupRowFilter from "./pages/access/GroupRowFilter";
import GroupColFilter from "./pages/access/GroupColFilter";
import AttributeAdmin from "./pages/access/AttributeAdmin";
import AttributePermission from "./pages/access/AttributePermission";
import AttributeUser from "./pages/access/AttributeUser";
import AttributeRowFilter from "./pages/access/AttributeRowFilter";
import AttributeColFilter from "./pages/access/AttributeColFilter";
import PositionAdmin from "./pages/access/PositionAdmin";
import PositionPermission from "./pages/access/PositionPermission";
import PositionUser from "./pages/access/PositionUser";
import PositionRowFilter from "./pages/access/PositionRowFilter";
import PositionColFilter from "./pages/access/PositionColFilter";
import AuthProvider from "./pages/oauth/AuthProvider";
import ProviderKey from "./pages/oauth/ProviderKey";
import ProviderApi from "./pages/oauth/ProviderApi";
import ProviderClient from "./pages/oauth/ProviderClient";
import ProductAdmin from "./pages/product/ProductAdmin";
import ProductEnvironment from "./pages/product/ProductEnvironment";
import ProductPipeline from "./pages/product/ProductPipeline";
import ProductConfig from "./pages/product/ProductConfig";
import ProductConfigProperty from "./pages/product/ProductConfigProperty";
import InstanceApi from "./pages/instance/InstanceApi";
import InstanceApiPathPrefix from "./pages/instance/InstanceApiPathPrefix";
import InstanceApp from "./pages/instance/InstanceApp";
import InstanceAppApi from "./pages/instance/InstanceAppApi";
import InstanceAdmin from "./pages/instance/InstanceAdmin";
import PlatformAdmin from "./pages/deployment/PlatformAdmin";
import PipelineAdmin from "./pages/deployment/PipelineAdmin";
import DeploymentAdmin from "./pages/deployment/DeploymentAdmin";
import DeploymentInstance from "./pages/deployment/DeploymentInstance";
import { useEffect } from "react";

const RedirectWithQuery = ({ to }: { to: string }) => {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there is a hash that looks like a path (e.g. #/app/dashboard?state=...)
    // This happens if variables passed back from OAuth provider are in the hash or if using HashRouter style links
    const hash = window.location.hash;

    // Check if we are already at the target path (to avoid loops or double redirects)
    // Note: window.location.pathname includes the leading slash
    if (window.location.pathname === to) {
      console.log('RedirectWithQuery: already at target path', to, '- aborting redirect to prevent loop/stripping params.');
      return;
    }

    let target = to + search;

    if (hash && hash.startsWith('#/')) {
      target = hash.substring(1); // Remove the #
      console.log('RedirectWithQuery: detected hash path, using it as target:', target);
    } else {
      console.log('RedirectWithQuery: no hash path detected, using default:', target);
    }

    // console.log('RedirectWithQuery: window.location.href=', window.location.href);
    navigate(target, { replace: true });
  }, [to, search, navigate]);

  return null;
};

const App = () => {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* Redirect from root to dashboard preserving query parameters */}
        <Route path="/" element={<RedirectWithQuery to="/app/dashboard" />} />

        {/* Layout routes */}
        <Route path="/app/*" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="blog/blogList" element={<BlogList />} />
          <Route path="form/:formId" element={<Form />} />
          <Route path="notification" element={<Notification />} />
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
          <Route path="user" element={<User />} />
          <Route path="userHost" element={<UserHost />} />
          <Route path="service/:apiType" element={<Service />} />
          <Route path="service/admin" element={<Service />} />
          <Route path="apiDetail" element={<ApiDetail />} />
          <Route path="openapiEditor" element={<OpenapiEditor />} />
          <Route path="hybridEditor" element={<HybridEditor />} />
          <Route path="graphqlEditor" element={<GraphqlEditor />} />
          <Route path="serviceEndpoint" element={<ServiceEndpoint />} />
          <Route path="listScope" element={<ListScope />} />
          <Route path="listRule" element={<ListRule />} />
          <Route path="access/roleAdmin" element={<RoleAdmin />} />
          <Route path="access/roleUser" element={<RoleUser />} />
          <Route path="access/rolePermission" element={<RolePermission />} />
          <Route path="access/roleRowFilter" element={<RoleRowFilter />} />
          <Route path="access/roleColFilter" element={<RoleColFilter />} />
          <Route path="access/groupAdmin" element={<GroupAdmin />} />
          <Route path="access/groupPermission" element={<GroupPermission />} />
          <Route path="access/groupUser" element={<GroupUser />} />
          <Route path="access/groupRowFilter" element={<GroupRowFilter />} />
          <Route path="access/groupColFilter" element={<GroupColFilter />} />
          <Route path="access/attributeAdmin" element={<AttributeAdmin />} />
          <Route
            path="access/attributePermission"
            element={<AttributePermission />}
          />
          <Route path="access/attributeUser" element={<AttributeUser />} />
          <Route path="access/attributeRowFilter" element={<AttributeRowFilter />} />
          <Route path="access/attributeColFilter" element={<AttributeColFilter />} />
          <Route path="access/positionAdmin" element={<PositionAdmin />} />
          <Route
            path="access/positionPermission"
            element={<PositionPermission />}
          />
          <Route path="access/positionUser" element={<PositionUser />} />
          <Route path="access/positionRowFilter" element={<PositionRowFilter />} />
          <Route path="access/positionColFilter" element={<PositionColFilter />} />
          <Route path="clientApp" element={<ClientApp />} />
          <Route path="ref/tableAdmin" element={<RefTableAdmin />} />
          <Route path="ref/value" element={<RefValue />} />
          <Route path="ref/locale" element={<RefLocale />} />
          <Route path="ref/relationTypeAdmin" element={<RelationTypeAdmin />} />
          <Route path="ref/relation" element={<RefRelation />} />
          <Route path="oauth/authProvider" element={<AuthProvider />} />
          <Route path="oauth/providerKey" element={<ProviderKey />} />
          <Route path="oauth/providerApi" element={<ProviderApi />} />
          <Route path="oauth/providerClient" element={<ProviderClient />} />
          <Route path="oauth/authClient" element={<AuthClient />} />
          <Route path="oauth/refreshToken" element={<RefreshToken />} />
          <Route path="oauth/authCode" element={<AuthCode />} />
          <Route path="category/admin" element={<Category />} />
          <Route path="tag/admin" element={<TagAdmin />} />
          <Route path="blog/adminList" element={<BlogAdmin />} />
          <Route path="blog/deleteBlog" element={<BlogDelete />} />
          <Route path="blog/:host/:id" element={<BlogItem />} />
          <Route path="error/adminList" element={<ErrorAdmin />} />
          <Route path="error/deleteBlog" element={<ErrorDelete />} />
          <Route path="error/:host/:errorCode" element={<ErrorItem />} />
          <Route path="schema/admin" element={<SchemaAdmin />} />
          <Route path="schedule/admin" element={<ScheduleAdmin />} />
          <Route path="rule/admin" element={<RuleAdmin />} />
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
          <Route path="config/configAdmin" element={<ConfigAdmin />} />
          <Route path="config/configProperty" element={<ConfigProperty />} />
          <Route
            path="config/configEnvironment"
            element={<ConfigEnvironment />}
          />
          <Route path="config/configProduct" element={<ConfigProduct />} />
          <Route
            path="config/configProductVersion"
            element={<ConfigProductVersion />}
          />
          <Route path="config/configInstance" element={<ConfigInstance />} />
          <Route
            path="config/configInstanceApi"
            element={<ConfigInstanceApi />}
          />
          <Route
            path="config/configInstanceApp"
            element={<ConfigInstanceApp />}
          />
          <Route
            path="config/configInstanceAppApi"
            element={<ConfigInstanceAppApi />}
          />
          <Route
            path="config/configInstanceFile"
            element={<ConfigInstanceFile />}
          />
          <Route
            path="config/configDeploymentInstance"
            element={<ConfigDeploymentInstance />}
          />
          <Route
            path="config/configSnapshot"
            element={<ConfigSnapshot />}
          />
          <Route path="controller/services" element={<CtrlPaneDashboard />} />
          <Route path="controller/check" element={<HealthCheck />} />
          <Route path="controller/info" element={<ServerInfo />} />
          <Route path="controller/logger" element={<LogViewer />} />
          <Route path="controller/logViewer" element={<LogViewer />} />
          <Route path="controller/loggerConfig" element={<LoggerConfig />} />
          <Route path="controller/logContent" element={<LogContent />} />
          <Route path="controller/chaos" element={<ChaosMonkey />} />
          <Route path="org/OrgAdmin" element={<OrgAdmin />} />
          <Route path="host/HostAdmin" element={<HostAdmin />} />
          <Route path="host/Host" element={<Host />} />
          <Route path="host/hostUser" element={<HostUser />} />
          <Route path="product/ProductAdmin" element={<ProductAdmin />} />
          <Route path="product/environment" element={<ProductEnvironment />} />
          <Route path="product/pipeline" element={<ProductPipeline />} />
          <Route path="product/config" element={<ProductConfig />} />
          <Route path="product/property" element={<ProductConfigProperty />} />
          <Route path="instance/InstanceApi" element={<InstanceApi />} />
          <Route
            path="instance/InstanceApiPathPrefix"
            element={<InstanceApiPathPrefix />}
          />
          <Route path="instance/InstanceApp" element={<InstanceApp />} />
          <Route path="instance/InstanceAppApi" element={<InstanceAppApi />} />
          <Route path="instance/InstanceAdmin" element={<InstanceAdmin />} />
          <Route path="deployment/PipelineAdmin" element={<PipelineAdmin />} />
          <Route path="deployment/PlatformAdmin" element={<PlatformAdmin />} />
          <Route
            path="deployment/DeploymentAdmin"
            element={<DeploymentAdmin />}
          />
          <Route path="deployment/instance" element={<DeploymentInstance />} />
        </Route>
        {/* Catch all route for 404 */}
        <Route path="*" element={<Error />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
