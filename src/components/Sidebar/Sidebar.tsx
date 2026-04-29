// import Drawer from '@mui/material/Drawer';
import {
  BorderAll as TableIcon,
  HelpOutline as FAQIcon,
  Home as HomeIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  NotificationsNone as NotificationsIcon,
  Search as SearchIcon,
  Toc as OrderIcon,
} from "@mui/icons-material";
import AccountBox from "@mui/icons-material/AccountBox";
import AddAlert from "@mui/icons-material/AddAlert";
import AlarmIcon from "@mui/icons-material/Alarm";
import AnnouncementIcon from "@mui/icons-material/Announcement";
import BookIcon from "@mui/icons-material/Book";
import Business from "@mui/icons-material/Business";
import CastForEducationIcon from "@mui/icons-material/CastForEducation";
import ForumIcon from "@mui/icons-material/Forum";
import HelpIcon from "@mui/icons-material/Help";
import PermDataSettingIcon from "@mui/icons-material/PermDataSetting";
import PublishIcon from "@mui/icons-material/Publish";
import SecurityIcon from "@mui/icons-material/Security";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import GiteIcon from "@mui/icons-material/Gite";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AppsIcon from "@mui/icons-material/Apps";
import ProductionQuantityLimitsIcon from "@mui/icons-material/ProductionQuantityLimits";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import AirplanemodeActiveIcon from "@mui/icons-material/AirplanemodeActive";
import AccessibleIcon from "@mui/icons-material/Accessible";
import EventIcon from "@mui/icons-material/Event";
import ApiIcon from "@mui/icons-material/Api";
import RuleIcon from "@mui/icons-material/Rule";
import CategoryIcon from "@mui/icons-material/Category";
import ScheduleIcon from "@mui/icons-material/Schedule";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SchemaIcon from "@mui/icons-material/Schema";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import { Box, IconButton, InputBase, List, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
// context
import {
  toggleSidebar,
  useLayoutDispatch,
  useLayoutState,
} from "../../contexts/LayoutContext";
import { useSiteDispatch } from "../../contexts/SiteContext";
import { useUserState } from "../../contexts/UserContext";
// api
import { apiPost } from "../../api/apiPost";
// header menu components
import CartMenu from "../Header/CartMenu";
import HomeMenu from "../Header/HomeMenu";
import MailMenu from "../Header/MailMenu";
import NotificationMenu from "../Header/NotificationMenu";
import ProfileMenu from "../Header/ProfileMenu";
// components
import SidebarLink from "./components/SidebarLink/SidebarLink";
// styles
import {
  StyledDrawer,
  SidebarListWrapper,
  SidebarTopSection,
  SidebarFooter,
} from "./SidebarStyles";

const structure = [
  { id: 0, label: "Home", link: "/app/dashboard", icon: <HomeIcon /> },

  // ── Guided Setup ──────────────────────────────────────
  {
    id: 500, type: "group", label: "Quick Start", defaultOpen: true,
    children: [
      { id: 2, label: "MCP Gateway", role: "user", link: "/app/mcp/gateway", icon: <RouterOutlinedIcon /> },
    ],
  },

  // ── Platform ──────────────────────────────────────────
  {
    id: 1000, type: "group", label: "Platform", defaultOpen: true,
    children: [
      { id: 5, label: "Controller", link: "/app/controller/services", icon: <SportsEsportsIcon /> },
      { id: 3, label: "Scheduler", link: "/app/scheduler", icon: <AlarmIcon /> },
      { id: 7, label: "Configuration", link: "/app/form/servicesRef", icon: <PermDataSettingIcon /> },
    ],
  },

  // ── Marketplace ───────────────────────────────────────
  {
    id: 2000, type: "group", label: "Marketplace", defaultOpen: true,
    children: [
      {
        id: 20, label: "Marketplace", link: "/app/marketplace", icon: <ShoppingBasketIcon />,
        children: [
          { label: "API Client", link: "/app/client" },
          { label: "OpenApi API", link: "/app/service/openapi" },
          { label: "GraphQL API", link: "/app/service/graphql" },
          { label: "Hybrid API", link: "/app/service/hybrid" },
          { label: "Schema Form", link: "/app/form/schemaFormFilter" },
          { label: "JSON Schema", link: "/app/schema/schemaList" },
          { label: "YAML Rule", link: "/app/rule/ruleList" },
        ],
      },
      {
        id: 23, label: "Publish", role: "user", link: "/app/publish", icon: <PublishIcon />,
        children: [
          { label: "OpenApi API", link: "/app/form/createService" },
          { label: "GraphQL API", link: "/app/form/createService" },
          { label: "Hybrid API", link: "/app/form/createService" },
          { label: "Schema Form", link: "/app/form/createSchemaForm" },
          { label: "JSON Schema", link: "/app/form/createJsonSchema" },
          { label: "Error Code", link: "/app/form/createErrorCode" },
          { label: "YAML Rule", link: "/app/form/createRule" },
        ],
      },
      {
        id: 10, label: "OAuth 2.0", role: "user", link: "/app/oauth", icon: <SecurityIcon />,
        children: [{ label: "Refresh Token", link: "/app/refreshToken" }],
      },
    ],
  },

  // ── Organisation ──────────────────────────────────────
  {
    id: 3000, type: "group", label: "Organisation",
    children: [
      { id: 24, label: "Host", role: "user", link: "/app/host/Host", icon: <GiteIcon /> },
      { id: 30, label: "Notification", role: "user", link: "/app/notification", icon: <NotificationsIcon /> },
    ],
  },

  // ── Community ─────────────────────────────────────────
  {
    id: 4000, type: "group", label: "Community",
    children: [
      {
        id: 65, label: "Training", role: "user", link: "/app/training", icon: <CastForEducationIcon />,
        children: [
          { label: "Course", link: "/app/edu/course" },
          { label: "Quiz", link: "/app/edu/quiz" },
          { label: "Progress", link: "/app/edu/progress" },
          { label: "Certificate", link: "/app/edu/certificate" },
        ],
      },
    ],
  },

  // ── Business ──────────────────────────────────────────
  {
    id: 5000, type: "group", label: "Business",
    children: [
      { id: 250, label: "Website", role: "user", link: "/app/covid/publish", icon: <Business /> },
      { id: 260, label: "Status", role: "user", link: "/app/covid/status", icon: <AddAlert /> },
      { id: 270, label: "User Id", link: "/app/covid/userId", icon: <AccountBox /> },
      { id: 280, label: "Merchant Orders", role: "merchant", link: "/app/merchantOrders", icon: <OrderIcon /> },
    ],
  },

  // ── Administration ────────────────────────────────────
  { id: 85, type: "divider", role: "admin" },
  {
    id: 9000, type: "group", label: "Administration", role: "admin",
    children: [
      { id: 90, label: "Org Admin", role: "admin", link: "/app/org/OrgAdmin", icon: <CorporateFareIcon /> },
      { id: 91, label: "Host Admin", role: "admin", link: "/app/host/HostAdmin", icon: <GiteIcon /> },
      { id: 92, label: "Ref Admin", role: "admin", link: "/app/ref/TableAdmin", icon: <TableIcon />, children: [{ label: "Ref Table", link: "/app/ref/TableAdmin" }, { label: "Relation Type", link: "/app/ref/RelationTypeAdmin" }] },
      { id: 93, label: "User Admin", role: "admin", link: "/app/user", icon: <PeopleAltIcon /> },
      { id: 94, label: "Event Admin", role: "admin", link: "/app/event/admin", icon: <EventIcon />, children: [{ label: "Export", link: "/app/form/exportPortalEvent" }, { label: "Import", link: "/app/form/importPortalEvent" }, { label: "Global Export", link: "/app/migration/export" }, { label: "Convert Snapshot", link: "/app/migration/convert" }] },
      { id: 95, label: "OAuth Admin", role: "admin", link: "/app/oauth/authProvider", icon: <SecurityIcon />, children: [{ label: "Auth Provider", link: "/app/oauth/authProvider" }, { label: "Auth Client", link: "/app/oauth/authClient" }, { label: "Sessions", link: "/app/oauth/authSession" }, { label: "Authorization Codes", link: "/app/oauth/authCode" }, { label: "Refresh Tokens", link: "/app/oauth/refreshToken" }, { label: "Session Audit", link: "/app/oauth/authSessionAudit" }] },
      { id: 100, label: "App Admin", role: "admin", link: "/app/clientApp", icon: <AppsIcon /> },
      { id: 101, label: "Product Admin", role: "admin", link: "/app/product/ProductAdmin", icon: <ProductionQuantityLimitsIcon /> },
      { id: 111, label: "Pipeline Admin", role: "admin", link: "/app/deployment/PipelineAdmin", icon: <SettingsInputComponentIcon /> },
      { id: 112, label: "Platform Admin", role: "admin", link: "/app/deployment/PlatformAdmin", icon: <IntegrationInstructionsIcon /> },
      { id: 113, label: "Instance Admin", role: "admin", link: "/app/instance/InstanceAdmin", icon: <ContentCopyIcon /> },
      { id: 113.5, label: "Runtime Instance", role: "admin", link: "/app/instance/RuntimeInstanceAdmin", icon: <ContentCopyIcon /> },
      { id: 114, label: "Deployment Admin", role: "admin", link: "/app/deployment/DeploymentAdmin", icon: <AirplanemodeActiveIcon /> },
      { id: 115, label: "Config Admin", role: "admin", link: "/app/config/configAdmin", icon: <PermDataSettingIcon /> },
      {
        id: 116, label: "Workflow Admin", role: "admin", link: "/app/workflow/WfDefinition", icon: <PrecisionManufacturingIcon />,
        children: [
          { label: "Wf Definition", link: "/app/workflow/WfDefinition" },
          { label: "Worklist", link: "/app/workflow/Worklist" },
          { label: "Process Info", link: "/app/workflow/ProcessInfo" },
          { label: "Agent Definition", link: "/app/genai/AgentDefinition" },
          { label: "Task Info", link: "/app/workflow/TaskInfo" },
          { label: "Task Asst", link: "/app/workflow/TaskAsst" },
          { label: "Audit Log", link: "/app/workflow/AuditLog" },
          { label: "Skill", link: "/app/genai/Skill" },
          { label: "Tool", link: "/app/genai/Tool" },
          { label: "Tool Param", link: "/app/genai/ToolParam" },
          { label: "Skill Dependency", link: "/app/genai/SkillDependency" },
          { label: "Agent Skill", link: "/app/genai/AgentSkill" },
          { label: "Agent Session", link: "/app/genai/AgentSessionHistory" },
          { label: "Session Memory", link: "/app/genai/SessionMemory" },
          { label: "User Memory", link: "/app/genai/UserMemory" },
          { label: "Agent Memory", link: "/app/genai/AgentMemory" },
          { label: "Org Memory", link: "/app/genai/OrgMemory" },
          { label: "GenAI Chat", link: "/app/genai/chat" },
        ],
      },
      { id: 117, label: "Access Admin", role: "admin", link: "/app/access/admin", icon: <AccessibleIcon />, children: [{ label: "Role", link: "/app/access/roleAdmin" }, { label: "Position", link: "/app/access/positionAdmin" }, { label: "Group", link: "/app/access/groupAdmin" }, { label: "Attribute", link: "/app/access/attributeAdmin" }] },
      { id: 118, label: "Api Admin", role: "admin", link: "/app/service/admin", icon: <ApiIcon /> },
      { id: 120, label: "Rule Admin", role: "admin", link: "/app/rule/admin", icon: <RuleIcon /> },
      { id: 123, label: "Tag Admin", role: "admin", link: "/app/tag/admin", icon: <LocalOfferIcon /> },
      { id: 125, label: "Category Admin", role: "admin", link: "/app/category/admin", icon: <CategoryIcon /> },
      { id: 127, label: "Schedule Admin", role: "admin", link: "/app/schedule/admin", icon: <ScheduleIcon /> },
      { id: 128, label: "Promotion", role: "admin", link: "/app/promotion/export", icon: <CompareArrowsIcon />, children: [{ label: "Export", link: "/app/promotion/export" }, { label: "Import", link: "/app/promotion/import" }, { label: "History", link: "/app/promotion/history" }] },
      { id: 130, label: "News Admin", role: "admin", link: "/app/news/admin", icon: <NewspaperIcon />, children: [{ label: "Create", link: "/app/news/create" }, { label: "Update", link: "/app/news/update" }, { label: "Delete", link: "/app/news/delete" }] },
      { id: 140, label: "Blog Admin", role: "admin", link: "/app/blog/admin", icon: <BookIcon />, children: [{ label: "List", link: "/app/blog/adminList" }, { label: "Create", link: "/app/form/createBlog" }, { label: "Update", link: "/app/blog/update" }, { label: "Delete", link: "/app/blog/delete" }] },
      { id: 141, label: "Error Admin", role: "admin", link: "/app/error/admin", icon: <ErrorOutlineIcon />, children: [{ label: "List", link: "/app/error/adminList" }, { label: "Create", link: "/app/form/createError" }, { label: "Update", link: "/app/error/update" }, { label: "Delete", link: "/app/error/delete" }] },
      { id: 142, label: "Schema Admin", role: "admin", link: "/app/schema/admin", icon: <SchemaIcon /> },
      { id: 150, label: "Forum Admin", role: "admin", link: "/app/forum/admin", icon: <ForumIcon />, children: [{ label: "Create", link: "/app/forum/create" }, { label: "Update", link: "/app/forum/update" }, { label: "Delete", link: "/app/forum/delete" }] },
      { id: 160, label: "Training Admin", link: "/app/edu/admin", icon: <ModelTrainingIcon />, children: [{ label: "List Quiz", link: "/app/form/listQuiz" }, { label: "Create Quiz", link: "/app/form/createQuiz" }, { label: "Update Quiz", link: "/app/edu/updateQuiz" }, { label: "Delete Quiz", link: "/app/edu/deleteQuiz" }] },
    ],
  },
];

function Sidebar() {
  var theme = useTheme();

  // global
  var { isSidebarOpened } = useLayoutState() as any;
  var layoutDispatch = useLayoutDispatch();
  var { roles, isAuthenticated, host } = useUserState();
  var siteDispatch: any = useSiteDispatch();
  const location = useLocation();

  // local
  var [isPermanent, setPermanent] = useState(true);
  var [domain, setDomain] = useState<string | null>(null);
  var [subDomain, setSubDomain] = useState<string | null>(null);

  const changeFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    siteDispatch({ type: "UPDATE_FILTER", filter: e.target.value });
  };

  useEffect(() => {
    if (isAuthenticated && host) {
      const cmd = {
        host: "lightapi.net",
        service: "host",
        action: "getHostById",
        version: "0.1.0",
        data: { hostId: host },
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      apiPost({ url, headers: {}, body: cmd })
        .then((result) => {
          if (result.data) {
            setDomain(result.data.domain);
            if (result.data.subDomain) setSubDomain(result.data.subDomain);
          } else if (result.error) {
            console.error("Error fetching host info:", result.error);
          }
        })
        .catch((error) => console.error("Error during apiPost:", error));
    }
  }, [isAuthenticated, host]);

  const apiPortalText = domain
    ? subDomain
      ? `${subDomain}.${domain} portal`
      : `${domain} portal`
    : "API Portal";

  useEffect(function () {
    window.addEventListener("resize", handleWindowWidthChange);
    handleWindowWidthChange();
    return function cleanup() {
      window.removeEventListener("resize", handleWindowWidthChange);
    };
  });

  return (
    <StyledDrawer
      variant={isPermanent ? "permanent" : "temporary"}
      open={isSidebarOpened}
    >
      <SidebarTopSection>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: isSidebarOpened ? "space-between" : "center", px: 1.5, minHeight: 60 }}>
            {isSidebarOpened && (
              <Link to="/app/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Box sx={{
                  width: 30, height: 30, borderRadius: "8px", flexShrink: 0,
                  background: "rgba(255,255,255,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
                }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: "rgba(255,255,255,0.9)" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.02em", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {apiPortalText}
                  </Typography>
                </Box>
              </Link>
            )}
            <IconButton
              onClick={() => toggleSidebar(layoutDispatch)}
              size="small"
              sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }, flexShrink: 0 }}
            >
              {isSidebarOpened ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
            </IconButton>
          </Box>
        </SidebarTopSection>
      <SidebarListWrapper>
        <List>
          {structure
            .filter((link) => permission(link.role, roles))
            .map((link) => (
              <SidebarLink
                key={link.id}
                isSidebarOpened={isSidebarOpened}
                nested={false}
                {...link}
              />
            ))}
        </List>
      </SidebarListWrapper>
      <SidebarFooter>
        {isSidebarOpened && (
          <Box sx={{ display: "flex", alignItems: "center", px: 1, pb: 0.5, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
            <SearchIcon sx={{ fontSize: 20, mr: 1, flexShrink: 0, color: "text.secondary" }} />
            <InputBase
              placeholder="Search…"
              onChange={changeFilter}
              sx={{ flex: 1, fontSize: 14 }}
            />
          </Box>
        )}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
          }}
        >
          {location.pathname.startsWith("/app/website") ? <HomeMenu /> : null}
          {location.pathname.startsWith("/app/website") ? <CartMenu /> : null}
          {isSidebarOpened && isAuthenticated ? <NotificationMenu openAbove /> : null}
          {isSidebarOpened && isAuthenticated ? <MailMenu openAbove /> : null}
          <ProfileMenu />
        </Box>
      </SidebarFooter>
    </StyledDrawer>
  );

  function permission(linkRole: string | undefined, userRoles: string | null) {
    if (userRoles == null) {
      if (linkRole == null) {
        return true;
      } else {
        return false;
      }
    } else {
      if (linkRole == null) {
        return true;
      } else {
        if (userRoles.includes(linkRole)) {
          return true;
        } else {
          return false;
        }
      }
    }
  }

  function handleWindowWidthChange() {
    var windowWidth = window.innerWidth;
    var breakpointWidth = (theme as any).breakpoints?.values?.md || 960;
    var isSmallScreen = windowWidth < breakpointWidth;

    if (isSmallScreen && isPermanent) {
      setPermanent(false);
    } else if (!isSmallScreen && !isPermanent) {
      setPermanent(true);
    }
  }
}

export default Sidebar;
