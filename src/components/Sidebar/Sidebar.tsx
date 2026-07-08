// import Drawer from '@mui/material/Drawer';
import {
  BorderAll as TableIcon,
  HelpOutline as FAQIcon,
  Home as HomeIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  NotificationsNone as NotificationsIcon,
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
import ChatIcon from '@mui/icons-material/Chat';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
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
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SchemaIcon from "@mui/icons-material/Schema";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import { Box, IconButton, List, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isSsoEnabled } from "../../../config";
// context
import {
  toggleSidebar,
  useLayoutDispatch,
  useLayoutState,
} from "../../contexts/LayoutContext";
import { useUserState } from "../../contexts/UserContext";
// api
import fetchClient from "../../utils/fetchClient";
// header menu components
import CartMenu from "../Header/CartMenu";
import HomeMenu from "../Header/HomeMenu";
import MailMenu from "../Header/MailMenu";
import NotificationMenu from "../Header/NotificationMenu";
import ProfileMenu from "../Header/ProfileMenu";
import TaskCommandPalette from "../../tasks/TaskCommandPalette";
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
  { id: 1, label: "Tasks", link: "/app/tasks", icon: <FactCheckOutlinedIcon /> },

  // ── Guided Setup ──────────────────────────────────────
  {
    id: 500, type: "group", label: "Quick Start", defaultOpen: true,
    children: [
      ...(isSsoEnabled
        ? [{ id: 2, label: "MCP Gateway", role: "user", link: "/app/mcp/gateway", icon: <RouterOutlinedIcon /> }]
        : []),
    ],
  },

  // ── Platform ──────────────────────────────────────────
  {
    id: 1000, type: "group", label: "Platform", defaultOpen: true,
    children: [
      { id: 5, label: "Controller", link: "/app/controller/services", icon: <SportsEsportsIcon /> },
      { id: 4, label: "GenAI Chat", link: "/app/genai/chat", icon: <ChatIcon /> },
      { id: 3, label: "Scheduler", link: "/app/scheduler", icon: <AlarmIcon /> },
    ],
  },

  // ── Marketplace ───────────────────────────────────────
  {
    id: 2000, type: "group", label: "Marketplace", defaultOpen: true,
    children: [
      {
        id: 20, label: "Marketplace", link: "/app/marketplace/api", icon: <ShoppingBasketIcon />,
        children: [
          { label: "API Catalog", link: "/app/marketplace/api" },
          { label: "Schema Catalog", link: "/app/marketplace/schema" },
          { label: "Workflow Catalog", link: "/app/marketplace/workflow" },
          { label: "API Client", link: "/app/client" },
          { label: "OpenApi API", link: "/app/service/openapi" },
          { label: "GraphQL API", link: "/app/service/graphql" },
          { label: "Hybrid API", link: "/app/service/hybrid" },
          { label: "Schema Form", link: "/app/form/schemaFormFilter" },
          { label: "JSON Schema", link: "/app/schema/schemaList" },
          { label: "YAML Rule", link: "/app/rule/ruleList" },
        ],
      },
      /*
      {
        id: 23, label: "Publish", role: "user", link: "/app/publish", icon: <PublishIcon />,
        children: [
          { label: "OpenApi API", link: "/app/form/createService" },
          { label: "GraphQL API", link: "/app/form/createService" },
          { label: "Hybrid API", link: "/app/form/createService" },
          { label: "Schema Form", link: "/app/form/createSchemaForm" },
          { label: "JSON Schema", link: "/app/form/createSchema" },
          { label: "Error Code", link: "/app/form/createErrorCode" },
          { label: "YAML Rule", link: "/app/form/createRule" },
        ],
      },
      */
    ],
  },

  // ── Organisation ──────────────────────────────────────
  {
    id: 3000, type: "group", label: "Organisation",
    children: [
      { id: 24, label: "User Host", role: "user", link: "/app/userHost", icon: <GiteIcon /> },
      {
        id: 25, label: "User Session", role: "user", link: "/app/user/session", icon: <SecurityIcon />,
        children: [
          { label: "Sessions", link: "/app/user/session" },
          { label: "Refresh Tokens", link: "/app/user/session/refresh-tokens" },
          { label: "Session Audit", link: "/app/user/session/audit" },
        ],
      },
      /* { id: 30, label: "Notification", role: "user", link: "/app/notification", icon: <NotificationsIcon /> }, */
    ],
  },

  // ── Community ─────────────────────────────────────────
  /*
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
  */

  // ── Business ──────────────────────────────────────────
  /*
  {
    id: 5000, type: "group", label: "Business",
    children: [
      { id: 250, label: "Website", role: "user", link: "/app/covid/publish", icon: <Business /> },
      { id: 260, label: "Status", role: "user", link: "/app/covid/status", icon: <AddAlert /> },
      { id: 270, label: "User Id", link: "/app/covid/userId", icon: <AccountBox /> },
      { id: 280, label: "Merchant Orders", role: "merchant", link: "/app/merchantOrders", icon: <OrderIcon /> },
    ],
  },
  */
  // ── Administration ────────────────────────────────────
  {
    id: 9000, type: "group", label: "Administration",
    children: [
      { id: 90, label: "Org Admin", link: "/app/org/OrgAdmin", icon: <CorporateFareIcon /> },
      { id: 91, label: "Host Admin", link: "/app/host/HostAdmin", icon: <GiteIcon /> },
      { id: 92, label: "Ref Admin", link: "/app/ref/TableAdmin", icon: <TableIcon />, children: [{ label: "Ref Table", link: "/app/ref/TableAdmin" }, { label: "Relation Type", link: "/app/ref/RelationTypeAdmin" }] },
      { id: 93, label: "User Admin", link: "/app/user", icon: <PeopleAltIcon /> },
      { id: 94, label: "Event Admin", link: "/app/event/notifications", icon: <EventIcon />, children: [{ label: "Notifications", link: "/app/event/notifications" }, { label: "Export", link: "/app/form/exportPortalEvent" }, { label: "Import", link: "/app/form/importPortalEvent" }, { label: "Global Export", link: "/app/migration/export" }, { label: "Convert Snapshot", link: "/app/migration/convert" }] },
      { id: 95, label: "OAuth Admin", role: "user oauth-client-admin", link: "/app/oauth/authClient", icon: <SecurityIcon />, children: [{ label: "Auth Provider", link: "/app/oauth/authProvider" }, { label: "Auth Client", role: "user oauth-client-admin", link: "/app/oauth/authClient" }, { label: "Sessions", link: "/app/oauth/authSession" }, { label: "Authorization Codes", link: "/app/oauth/authCode" }, { label: "Refresh Tokens", link: "/app/oauth/refreshToken" }, { label: "Session Audit", link: "/app/oauth/authSessionAudit" }] },
      { id: 100, label: "App Admin", role: "user app-admin", link: "/app/clientApp", icon: <AppsIcon /> },
      { id: 101, label: "Product Admin", link: "/app/product/ProductAdmin", icon: <ProductionQuantityLimitsIcon /> },
      { id: 111, label: "Pipeline Admin", link: "/app/deployment/PipelineAdmin", icon: <SettingsInputComponentIcon /> },
      { id: 112, label: "Platform Admin", link: "/app/deployment/PlatformAdmin", icon: <IntegrationInstructionsIcon /> },
      { id: 113, label: "Instance Admin", role: "user instance-admin", link: "/app/instance/InstanceAdmin", icon: <ContentCopyIcon /> },
      { id: 113.5, label: "Runtime Instance", role: "user instance-admin", link: "/app/instance/RuntimeInstanceAdmin", icon: <DirectionsRunIcon /> },
      { id: 114, label: "Deployment Admin", link: "/app/deployment/DeploymentAdmin", icon: <AirplanemodeActiveIcon /> },
      {
        id: 115, label: "Config Admin", link: "/app/config/configAdmin", icon: <PermDataSettingIcon />,
        children: [
          { label: "Config Records", link: "/app/config/configAdmin" },
          { label: "Config Update", link: "/app/config/update" },
        ],
      },
      {
        id: 115.5, label: "GenAI Admin", link: "/app/genai/chat", icon: <PrecisionManufacturingIcon />,
        children: [
          { label: "Agent Definition", link: "/app/genai/AgentDefinition" },
          { label: "Skill", link: "/app/genai/Skill" },
          { label: "Tool", link: "/app/genai/Tool" },
          { label: "Tool Param", link: "/app/genai/ToolParam" },
          { label: "Skill Tool", link: "/app/genai/SkillTool" },
          { label: "Skill Workflow", link: "/app/genai/SkillWorkflow" },
          { label: "Skill Dependency", link: "/app/genai/SkillDependency" },
          { label: "Agent Skill", link: "/app/genai/AgentSkill" },
          { label: "Agent Assignment", link: "/app/genai/AgentAssignment" },
          { label: "Agent Session", link: "/app/genai/AgentSessionHistory" },
          { label: "Session Memory", link: "/app/genai/SessionMemory" },
          { label: "User Memory", link: "/app/genai/UserMemory" },
          { label: "Agent Memory", link: "/app/genai/AgentMemory" },
          { label: "Org Memory", link: "/app/genai/OrgMemory" },
        ],
      },
      {
        id: 116, label: "Workflow Admin", role: "user workflow-admin", link: "/app/workflow/WfDefinition", icon: <AccountTreeIcon />,
        children: [
          { label: "Wf Definition", role: "user workflow-admin", link: "/app/workflow/WfDefinition" },
          { label: "Workflow Editor", role: "user workflow-admin", link: "/app/workflow/editor" },
          { label: "Human Tasks", link: "/app/workflow/HumanTasks" },
          { label: "Worklist", link: "/app/workflow/Worklist" },
          { label: "Process Info", link: "/app/workflow/ProcessInfo" },
          { label: "Task Info", link: "/app/workflow/TaskInfo" },
          { label: "Task Asst", link: "/app/workflow/TaskAsst" },
          { label: "Audit Log", link: "/app/workflow/AuditLog" },
        ],
      },
      { id: 117, label: "Access Admin", role: "access-admin", link: "/app/access/admin", icon: <AccessibleIcon />, children: [{ label: "Portal Handlers", role: "access-admin", link: "/app/access/admin" }, { label: "Role", role: "access-admin", link: "/app/access/roleAdmin" }, { label: "Position", role: "access-admin", link: "/app/access/positionAdmin" }, { label: "Group", role: "access-admin", link: "/app/access/groupAdmin" }, { label: "Attribute", role: "access-admin", link: "/app/access/attributeAdmin" }] },
      { id: 118, label: "Api Admin", role: "user api-admin", link: "/app/service/admin", icon: <ApiIcon /> },
      { id: 120, label: "Rule Admin", link: "/app/rule/admin", icon: <RuleIcon /> },
      { id: 123, label: "Tag Admin", link: "/app/tag/admin", icon: <LocalOfferIcon /> },
      { id: 125, label: "Category Admin", link: "/app/category/admin", icon: <CategoryIcon /> },
      { id: 127, label: "Schedule Admin", role: "user schedule-admin", link: "/app/schedule/admin", icon: <ScheduleIcon /> },
      { id: 128, label: "Promotion", link: "/app/promotion/export", icon: <CompareArrowsIcon />, children: [{ label: "Export", link: "/app/promotion/export" }, { label: "Import", link: "/app/promotion/import" }, { label: "History", link: "/app/promotion/history" }] },
      /* { id: 130, label: "News Admin", link: "/app/news/admin", icon: <NewspaperIcon />, children: [{ label: "Create", link: "/app/news/create" }, { label: "Update", link: "/app/news/update" }, { label: "Delete", link: "/app/news/delete" }] }, */
      /* { id: 140, label: "Blog Admin", link: "/app/blog/admin", icon: <BookIcon />, children: [{ label: "List", link: "/app/blog/adminList" }, { label: "Create", link: "/app/form/createBlog" }, { label: "Update", link: "/app/blog/update" }, { label: "Delete", link: "/app/blog/delete" }] }, */
      { id: 141, label: "Error Admin", link: "/app/error/admin", icon: <ErrorOutlineIcon />, children: [{ label: "List", link: "/app/error/adminList" }, { label: "Create", link: "/app/form/createError" }, { label: "Update", link: "/app/error/update" }, { label: "Delete", link: "/app/error/delete" }] },
      { id: 142, label: "Schema Admin", link: "/app/schema/admin", icon: <SchemaIcon /> },
      /* { id: 150, label: "Forum Admin", link: "/app/forum/admin", icon: <ForumIcon />, children: [{ label: "Create", link: "/app/forum/create" }, { label: "Update", link: "/app/forum/update" }, { label: "Delete", link: "/app/forum/delete" }] }, */
      /* { id: 160, label: "Training Admin", link: "/app/edu/admin", icon: <ModelTrainingIcon />, children: [{ label: "List Quiz", link: "/app/form/listQuiz" }, { label: "Create Quiz", link: "/app/form/createQuiz" }, { label: "Update Quiz", link: "/app/edu/updateQuiz" }, { label: "Delete Quiz", link: "/app/edu/deleteQuiz" }] }, */
    ],
  },
];

function Sidebar() {
  const theme = useTheme();

  // global
  const { isSidebarOpened } = useLayoutState() as any;
  const layoutDispatch = useLayoutDispatch();
  const { roles, isAuthenticated, host } = useUserState();
  const location = useLocation();

  // local
  const [isPermanent, setPermanent] = useState(true);
  const [domain, setDomain] = useState<string | null>(null);
  const [subDomain, setSubDomain] = useState<string | null>(null);

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
      fetchClient(url)
        .then((result) => {
          if (result?.domain) {
            setDomain(result.domain);
            setSubDomain(result.subDomain || null);
          }
        })
        .catch((error) => console.error("Error fetching host info:", error));
    }
  }, [isAuthenticated, host]);

  const apiPortalText = domain
    ? subDomain
      ? `${subDomain}.${domain} portal`
      : `${domain} portal`
    : "API Portal";
  const visibleStructure = filterSidebarItems(structure, roles);

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
          {visibleStructure
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
          <Box sx={{ pb: 0.5 }}>
            <TaskCommandPalette />
          </Box>
        )}
        {!isSidebarOpened && <TaskCommandPalette collapsed />}
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

  function handleWindowWidthChange() {
    const windowWidth = window.innerWidth;
    const breakpointWidth = (theme as any).breakpoints?.values?.md || 960;
    const isSmallScreen = windowWidth < breakpointWidth;

    if (isSmallScreen && isPermanent) {
      setPermanent(false);
    } else if (!isSmallScreen && !isPermanent) {
      setPermanent(true);
    }
  }
}

function filterSidebarItems(items: any[], userRoles: string | null, insideAdminSection = false): any[] {
  const isAdmin = hasSidebarRole(userRoles, "admin host-admin");

  return items.reduce<any[]>((visibleItems, item) => {
    const inAdminSection = insideAdminSection || item.id === 9000;
    const children = item.children ? filterSidebarItems(item.children, userRoles, inAdminSection) : undefined;
    const visibleChildren = children?.length ? children : undefined;

    if (item.type === "group") {
      if (visibleChildren) {
        visibleItems.push({ ...item, children: visibleChildren });
      }
      return visibleItems;
    }

    if (canShowSidebarItem(item, userRoles, inAdminSection, isAdmin)) {
      visibleItems.push(visibleChildren ? { ...item, children: visibleChildren } : { ...item, children: undefined });
    }

    return visibleItems;
  }, []);
}

function canShowSidebarItem(item: any, userRoles: string | null, insideAdminSection: boolean, isAdmin: boolean) {
  if (item.role != null && hasSidebarRole(item.role, "access-admin")) {
    return hasSidebarRole(userRoles, "admin access-admin");
  }
  if (isAdmin) return true;
  if (insideAdminSection && item.role == null) return false;
  if (item.role == null) return true;
  return hasSidebarRole(userRoles, item.role);
}

function hasSidebarRole(userRoles: string | null, requiredRoles: string) {
  if (!userRoles) return false;

  const userRoleSet = new Set(userRoles.split(/[\s,]+/).filter(Boolean));
  return requiredRoles
    .split(/[\s,]+/)
    .filter(Boolean)
    .some((role) => userRoleSet.has(role));
}

export default Sidebar;
