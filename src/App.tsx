import { BrowserRouter, Routes, Navigate, Route } from "react-router-dom";
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
import Service from "./pages/service/Service";
import ServiceDelete from "./pages/service/ServiceDelete";
import ServiceDetail from "./pages/service/ServiceDetail";
import OpenapiEditor from "./pages/service/OpenapiEditor";
import HybridEditor from "./pages/service/HybridEditor";
import GraphqlEditor from "./pages/service/GraphqlEditor";
import SubmitSpec from "./pages/service/SubmitSpec";
import ServiceEndpoint from "./pages/service/ServiceEndpoint";
import ListScope from "./pages/service/ListScope";
import ListRule from "./pages/service/ListRule";
import ClientApp from "./pages/client/ClientApp";
import Client from "./pages/oauth/Client";
import RefreshToken from "./pages/oauth/RefreshToken";
import RefreshTokenDelete from "./pages/oauth/RefreshTokenDelete";
import RefreshTokenDetail from "./pages/oauth/RefreshTokenDetail";
import RefTableAdmin from "./pages/ref/RefTableAdmin";
import RefValue from "./pages/ref/RefValue";
import RefLocale from "./pages/ref/RefLocale";
import RelationTypeAdmin from "./pages/ref/RelationTypeAdmin";
import RefRelation from "./pages/ref/RefRelation";
import ClientDelete from "./pages/oauth/ClientDelete";
import Category from "./pages/category/Category";
import BlogAdmin from "./pages/blog/BlogAdmin";
import BlogDelete from "./pages/blog/BlogDelete";
import BlogItem from "./pages/blog/BlogItem";
import ErrorAdmin from "./pages/error/ErrorAdmin";
import ErrorDelete from "./pages/error/ErrorDelete";
import ErrorItem from "./pages/error/ErrorItem";
import SchemaAdmin from "./pages/schema/SchemaAdmin";
import SchemaDelete from "./pages/schema/SchemaDelete";
import SchemaList from "./pages/schema/SchemaList";
import SchemaItem from "./pages/schema/SchemaItem";
import ScheduleAdmin from "./pages/schedule/ScheduleAdmin";
import RuleAdmin from "./pages/rule/RuleAdmin";
import RuleDelete from "./pages/rule/RuleDelete";
import RuleItem from "./pages/rule/RuleItem";
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
import ConfigDeploymentInstance from "./pages/config/ConfigDeploymentInstance";
import Properties from "./pages/config/Properties";
import GlobalValues from "./pages/config/GlobalValues";
import GlobalValueDelete from "./pages/config/GlobalValueDelete";
import GlobalFiles from "./pages/config/GlobalFiles";
import GlobalFileUpload from "./pages/config/GlobalFileUpload";
import GlobalFileUpdate from "./pages/config/GlobalFileUpdate";
import GlobalFileDelete from "./pages/config/GlobalFileDelete";
import GlobalCerts from "./pages/config/GlobalCerts";
import GlobalCertUpload from "./pages/config/GlobalCertUpload";
import GlobalCertUpdate from "./pages/config/GlobalCertUpdate";
import GlobalCertDelete from "./pages/config/GlobalCertDelete";
import Services from "./pages/config/Services";
import ServiceFiles from "./pages/config/ServiceFiles";
import ServiceFileUpload from "./pages/config/ServiceFileUpload";
import ServiceFileUpdate from "./pages/config/ServiceFileUpdate";
import ServiceFileDelete from "./pages/config/ServiceFileDelete";
import ServiceCerts from "./pages/config/ServiceCerts";
import ServiceCertUpload from "./pages/config/ServiceCertUpload";
import ServiceCertUpdate from "./pages/config/ServiceCertUpdate";
import ServiceCertDelete from "./pages/config/ServiceCertDelete";
import ServiceProperties from "./pages/config/ServiceProperties";
import DeleteProperty from "./pages/config/DeleteProperty";
import DeleteService from "./pages/config/DeleteService";
import DeleteServiceProperty from "./pages/config/DeleteServiceProperty";
import CtrlPaneDashboard from "./pages/controller/CtrlPaneDashboard";
import HealthCheck from "./pages/controller/HealthCheck";
import ServerInfo from "./pages/controller/ServerInfo";
import LogViewer from "./pages/controller/LogViewer";
import LoggerConfig from "./pages/controller/LoggerConfig";
import LogContent from "./pages/controller/LogContent";
import ChaosMonkey from "./pages/controller/ChaosMonkey";
import Host from "./pages/host/Host";
import HostAdmin from "./pages/host/HostAdmin";
import RoleAdmin from "./pages/access/RoleAdmin";
import RoleUser from "./pages/access/RoleUser";
import RolePermission from "./pages/access/RolePermission";
import RoleRowFilter from "./pages/access/RoleRowFilter";
import RoleColFilter from "./pages/access/RoleColFilter";
import GroupAdmin from "./pages/access/GroupAdmin";
import GroupPermission from "./pages/access/GroupPermission";
import GroupUser from "./pages/access/GroupUser";
import AttributeAdmin from "./pages/access/AttributeAdmin";
import AttributePermission from "./pages/access/AttributePermission";
import AttributeUser from "./pages/access/AttributeUser";
import PositionAdmin from "./pages/access/PositionAdmin";
import PositionPermission from "./pages/access/PositionPermission";
import PositionUser from "./pages/access/PositionUser";
import AuthProvider from "./pages/oauth/AuthProvider";
import ProviderKey from "./pages/oauth/ProviderKey";
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

const App = () => {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* Redirect from root to dashboard */}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

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
          <Route path="service/:apiType" element={<Service />} />
          <Route path="service/admin" element={<Service />} />
          <Route path="deleteService" element={<ServiceDelete />} />
          <Route path="serviceDetail" element={<ServiceDetail />} />
          <Route path="openapiEditor" element={<OpenapiEditor />} />
          <Route path="hybridEditor" element={<HybridEditor />} />
          <Route path="graphqlEditor" element={<GraphqlEditor />} />
          <Route path="submitSpec" element={<SubmitSpec />} />
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
          <Route path="access/attributeAdmin" element={<AttributeAdmin />} />
          <Route
            path="access/attributePermission"
            element={<AttributePermission />}
          />
          <Route path="access/attributeUser" element={<AttributeUser />} />
          <Route path="access/positionAdmin" element={<PositionAdmin />} />
          <Route
            path="access/positionPermission"
            element={<PositionPermission />}
          />
          <Route path="access/positionUser" element={<PositionUser />} />
          <Route path="clientApp" element={<ClientApp />} />
          <Route path="client" element={<Client />} />
          <Route path="refreshToken" element={<RefreshToken />} />
          <Route path="deleteRefreshToken" element={<RefreshTokenDelete />} />
          <Route path="refreshTokenDetail" element={<RefreshTokenDetail />} />
          <Route path="ref/tableAdmin" element={<RefTableAdmin />} />
          <Route path="ref/value" element={<RefValue />} />
          <Route path="ref/locale" element={<RefLocale />} />
          <Route path="ref/relationTypeAdmin" element={<RelationTypeAdmin />} />
          <Route path="ref/relation" element={<RefRelation />} />
          <Route path="oauth/authProvider" element={<AuthProvider />} />
          <Route path="oauth/providerKey" element={<ProviderKey />} />
          <Route path="oauth/client" element={<Client />} />
          <Route path="oauth/deleteClient" element={<ClientDelete />} />
          <Route path="category/admin" element={<Category />} />
          <Route path="blog/adminList" element={<BlogAdmin />} />
          <Route path="blog/deleteBlog" element={<BlogDelete />} />
          <Route path="blog/:host/:id" element={<BlogItem />} />
          <Route path="error/adminList" element={<ErrorAdmin />} />
          <Route path="error/deleteBlog" element={<ErrorDelete />} />
          <Route path="error/:host/:errorCode" element={<ErrorItem />} />
          <Route path="schema/adminList" element={<SchemaAdmin />} />
          <Route path="schedule/admin" element={<ScheduleAdmin />} />
          <Route path="schema/deleteSchema" element={<SchemaDelete />} />
          <Route path="schema/schemaList" element={<SchemaList />} />
          <Route path="schema/:host/:id" element={<SchemaItem />} />
          <Route path="rule/admin" element={<RuleAdmin />} />
          <Route path="rule/deleteRule" element={<RuleDelete />} />
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
          <Route path="config/properties" element={<Properties />} />
          <Route path="config/globalValues" element={<GlobalValues />} />
          <Route
            path="config/globalValueDelete"
            element={<GlobalValueDelete />}
          />
          <Route path="config/globalFiles" element={<GlobalFiles />} />
          <Route
            path="config/globalFileUpload"
            element={<GlobalFileUpload />}
          />
          <Route
            path="config/globalFileUpdate"
            element={<GlobalFileUpdate />}
          />
          <Route
            path="config/globalFileDelete"
            element={<GlobalFileDelete />}
          />
          <Route path="config/globalCerts" element={<GlobalCerts />} />
          <Route
            path="config/globalCertUpload"
            element={<GlobalCertUpload />}
          />
          <Route
            path="config/globalCertUpdate"
            element={<GlobalCertUpdate />}
          />
          <Route
            path="config/globalCertDelete"
            element={<GlobalCertDelete />}
          />
          <Route path="config/services" element={<Services />} />
          <Route path="config/serviceFiles" element={<ServiceFiles />} />
          <Route
            path="config/serviceFileUpload"
            element={<ServiceFileUpload />}
          />
          <Route
            path="config/serviceFileUpdate"
            element={<ServiceFileUpdate />}
          />
          <Route
            path="config/serviceFileDelete"
            element={<ServiceFileDelete />}
          />
          <Route path="config/serviceCerts" element={<ServiceCerts />} />
          <Route
            path="config/serviceCertUpload"
            element={<ServiceCertUpload />}
          />
          <Route
            path="config/serviceCertUpdate"
            element={<ServiceCertUpdate />}
          />
          <Route
            path="config/serviceCertDelete"
            element={<ServiceCertDelete />}
          />
          <Route
            path="config/serviceProperties"
            element={<ServiceProperties />}
          />
          <Route path="config/deleteProperty" element={<DeleteProperty />} />
          <Route path="config/deleteService" element={<DeleteService />} />
          <Route
            path="config/deleteServiceProperty"
            element={<DeleteServiceProperty />}
          />
          <Route path="controller/services" element={<CtrlPaneDashboard />} />
          <Route path="controller/check" element={<HealthCheck />} />
          <Route path="controller/info" element={<ServerInfo />} />
          <Route path="controller/logger" element={<LogViewer />} />
          <Route path="controller/logViewer" element={<LogViewer />} />
          <Route path="controller/loggerConfig" element={<LoggerConfig />} />
          <Route path="controller/logContent" element={<LogContent />} />
          <Route path="controller/chaos" element={<ChaosMonkey />} />
          <Route path="host/HostAdmin" element={<HostAdmin />} />
          <Route path="host/Host" element={<Host />} />
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
