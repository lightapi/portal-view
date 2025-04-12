// import Drawer from '@mui/material/Drawer';
import {
  ArrowBack as ArrowBackIcon,
  BorderAll as TableIcon,
  HelpOutline as FAQIcon,
  Home as HomeIcon,
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
import AirplanemodeActiveIcon from "@mui/icons-material/AirplanemodeActive";
import AccessibleIcon from "@mui/icons-material/Accessible";
import EventIcon from "@mui/icons-material/Event";
import ApiIcon from "@mui/icons-material/Api";
import RuleIcon from "@mui/icons-material/Rule";
import CategoryIcon from "@mui/icons-material/Category";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SchemaIcon from "@mui/icons-material/Schema";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import { Drawer, IconButton, List } from "@mui/material";
import { useTheme } from "@mui/styles";
import classNames from "classnames";
import { useEffect, useState } from "react";
// context
import {
  toggleSidebar,
  useLayoutDispatch,
  useLayoutState,
} from "../../contexts/LayoutContext";
import { useUserState } from "../../contexts/UserContext";
// components
import SidebarLink from "./components/SidebarLink/SidebarLink";
// styles
import useStyles from "./styles";

const structure = [
  { id: 0, label: "Dashboard", link: "/app/dashboard", icon: <HomeIcon /> },
  { id: 3, label: "Scheduler", link: "/app/scheduler", icon: <AlarmIcon /> },
  {
    id: 5,
    label: "Controller",
    link: "/app/controller/services",
    icon: <SportsEsportsIcon />,
  },
  {
    id: 7,
    label: "Configuration",
    link: "/app/form/servicesRef",
    icon: <PermDataSettingIcon />,
  },
  {
    id: 10,
    label: "OAuth 2.0",
    role: "user",
    link: "/app/oauth",
    icon: <SecurityIcon />,
    children: [{ label: "Refresh Token", link: "/app/refreshToken" }],
  },
  {
    id: 20,
    label: "Marketplace",
    link: "/app/marketplace",
    icon: <ShoppingBasketIcon />,
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
    id: 23,
    label: "Publish",
    role: "user",
    link: "/app/publish",
    icon: <PublishIcon />,
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
    id: 24,
    label: "Host",
    role: "user",
    link: "/app/host/Host",
    icon: <GiteIcon />,
  },
  {
    id: 25,
    label: "Reference",
    role: "admin",
    link: "/app/reference",
    icon: <TableIcon />,
    children: [
      { label: "Table", link: "/app/ref/table" },
      { label: "Value", link: "/app/ref/tableForm" },
      { label: "Locale", link: "/app/ref/valueForm" },
      { label: "RelaType", link: "/app/ref/relatype" },
      { label: "Relation", link: "/app/ref/relationForm" },
    ],
  },
  {
    id: 30,
    label: "Notification",
    role: "user",
    link: "/app/notification",
    icon: <NotificationsIcon />,
  },
  { id: 40, label: "News", link: "/app/news", icon: <AnnouncementIcon /> },
  { id: 50, label: "Blog", link: "/app/blog/blogList", icon: <BookIcon /> },
  { id: 60, label: "Forum", link: "/app/forum", icon: <ForumIcon /> },
  {
    id: 65,
    label: "Training",
    role: "user",
    link: "/app/training",
    icon: <CastForEducationIcon />,
    children: [
      { label: "Course", link: "/app/edu/course" },
      { label: "Quiz", link: "/app/edu/quiz" },
      { label: "Progress", link: "/app/edu/progress" },
      { label: "Certificate", link: "/app/edu/certificate" },
    ],
  },
  { id: 70, label: "Support", link: "/app/support", icon: <HelpIcon /> },
  { id: 80, label: "FAQ", link: "/app/faq", icon: <FAQIcon /> },
  // {
  //   id: 85,
  //   label: 'Tool',
  //   link: '/app/tool',
  //   icon: <HandymanIcon />,
  //   children: [
  //     { label: 'JSON Compare', link: '/app/tool/jsonCompare' },
  //     { label: 'YAML Compare', link: '/app/tool/yamlCompare' },
  //     { label: 'JSON Normalize', link: '/app/tool/jsonNormalize' },
  //     { label: 'YAML Normalize', link: '/app/tool/yamlNormalize' },
  //   ],
  // },
  { id: 90, type: "divider", role: "admin" },
  {
    id: 91,
    label: "Host Admin",
    role: "admin",
    link: "/app/host/HostAdmin",
    icon: <GiteIcon />,
  },
  {
    id: 92,
    label: "User Admin",
    role: "admin",
    link: "/app/user",
    icon: <PeopleAltIcon />,
  },
  {
    id: 93,
    label: "Event Admin",
    role: "admin",
    link: "/app/event/admin",
    icon: <EventIcon />,
    children: [
      { label: "Export", link: "/app/form/exportPortalEvent" },
      { label: "Import", link: "/app/form/importPortalEvent" },
    ],
  },
  {
    id: 95,
    label: "OAuth Admin",
    role: "admin",
    link: "/app/oauth/authProvider",
    icon: <SecurityIcon />,
  },
  {
    id: 100,
    label: "App Admin",
    role: "admin",
    link: "/app/clientApp",
    icon: <AppsIcon />,
  },
  {
    id: 101,
    label: "Product Admin",
    role: "admin",
    link: "/app/product/ProductAdmin",
    icon: <ProductionQuantityLimitsIcon />,
  },
  {
    id: 111,
    label: "Pipeline Admin",
    role: "admin",
    link: "/app/deployment/PipelineAdmin",
    icon: <SettingsInputComponentIcon />,
  },
  {
    id: 112,
    label: "Platform Admin",
    role: "admin",
    link: "/app/deployment/PlatformAdmin",
    icon: <IntegrationInstructionsIcon />,
  },
  {
    id: 113,
    label: "Instance Admin",
    role: "admin",
    link: "/app/instance/InstanceAdmin",
    icon: <ContentCopyIcon />,
  },
  {
    id: 114,
    label: "Deployment Admin",
    role: "admin",
    link: "/app/deployment/DeploymentAdmin",
    icon: <AirplanemodeActiveIcon />,
  },
  {
    id: 115,
    label: "Config Admin",
    role: "admin",
    link: "/app/config/configAdmin",
    icon: <PermDataSettingIcon />,
  },
  {
    id: 116,
    label: "Access Admin",
    role: "admin",
    link: "/app/access/admin",
    icon: <AccessibleIcon />,
    children: [
      { label: "Role", link: "/app/access/roleAdmin" },
      { label: "Position", link: "/app/access/positionAdmin" },
      { label: "Group", link: "/app/access/groupAdmin" },
      { label: "Attribute", link: "/app/access/attributeAdmin" },
    ],
  },
  {
    id: 118,
    label: "Api Admin",
    role: "admin",
    link: "/app/service/admin",
    icon: <ApiIcon />,
  },
  {
    id: 120,
    label: "Rule Admin",
    role: "admin",
    link: "/app/rule/admin",
    icon: <RuleIcon />,
  },
  {
    id: 125,
    label: "Category Admin",
    role: "admin",
    link: "/app/category/admin",
    icon: <CategoryIcon />,
  },
  {
    id: 130,
    label: "News Admin",
    role: "admin",
    link: "/app/news/admin",
    icon: <NewspaperIcon />,
    children: [
      { label: "Create", link: "/app/news/create" },
      { label: "Update", link: "/app/news/update" },
      { label: "Delete", link: "/app/news/delete" },
    ],
  },
  {
    id: 140,
    label: "Blog Admin",
    role: "admin",
    link: "/app/blog/admin",
    icon: <BookIcon />,
    children: [
      { label: "List", link: "/app/blog/adminList" },
      { label: "Create", link: "/app/form/createBlog" },
      { label: "Update", link: "/app/blog/update" },
      { label: "Delete", link: "/app/blog/delete" },
    ],
  },
  {
    id: 141,
    label: "Error Admin",
    role: "admin",
    link: "/app/error/admin",
    icon: <ErrorOutlineIcon />,
    children: [
      { label: "List", link: "/app/error/adminList" },
      { label: "Create", link: "/app/form/createError" },
      { label: "Update", link: "/app/error/update" },
      { label: "Delete", link: "/app/error/delete" },
    ],
  },
  {
    id: 142,
    label: "Schema Admin",
    role: "admin",
    link: "/app/schema/admin",
    icon: <SchemaIcon />,
    children: [
      { label: "List", link: "/app/schema/adminList" },
      { label: "Create", link: "/app/form/createJsonSchema" },
      { label: "Update", link: "/app/schema/update" },
      { label: "Delete", link: "/app/schema/delete" },
    ],
  },
  {
    id: 150,
    label: "Forum Admin",
    role: "admin",
    link: "/app/forum/admin",
    icon: <ForumIcon />,
    children: [
      { label: "Create", link: "/app/forum/create" },
      { label: "Update", link: "/app/forum/update" },
      { label: "Delete", link: "/app/forum/delete" },
    ],
  },
  {
    id: 160,
    label: "Training Admin",
    link: "/app/edu/admin",
    icon: <ModelTrainingIcon />,
    children: [
      { label: "List Quiz", link: "/app/form/listQuiz" },
      { label: "Create Quiz", link: "/app/form/createQuiz" },
      { label: "Update Quiz", link: "/app/edu/updateQuiz" },
      { label: "Delete Quiz", link: "/app/edu/deleteQuiz" },
    ],
  },
  { id: 200, type: "divider" },
  {
    id: 250,
    label: "Website",
    role: "user",
    link: "/app/covid/publish",
    icon: <Business />,
  },
  {
    id: 260,
    label: "Status",
    role: "user",
    link: "/app/covid/status",
    icon: <AddAlert />,
  },
  {
    id: 270,
    label: "User Id",
    link: "/app/covid/userId",
    icon: <AccountBox />,
  },
  {
    id: 280,
    label: "Merchant Orders",
    role: "merchant",
    link: "/app/merchantOrders",
    icon: <OrderIcon />,
  },
];

function Sidebar() {
  var classes = useStyles();
  var theme = useTheme();

  // global
  var { isSidebarOpened } = useLayoutState();
  var layoutDispatch = useLayoutDispatch();
  var { roles } = useUserState();

  // local
  var [isPermanent, setPermanent] = useState(true);

  useEffect(function () {
    window.addEventListener("resize", handleWindowWidthChange);
    handleWindowWidthChange();
    return function cleanup() {
      window.removeEventListener("resize", handleWindowWidthChange);
    };
  });

  return (
    <Drawer
      variant={isPermanent ? "permanent" : "temporary"}
      className={classNames(classes.drawer, {
        [classes.drawerOpen]: isSidebarOpened,
        [classes.drawerClose]: !isSidebarOpened,
      })}
      classes={{
        paper: classNames({
          [classes.drawerOpen]: isSidebarOpened,
          [classes.drawerClose]: !isSidebarOpened,
        }),
      }}
      open={isSidebarOpened}
    >
      <div className={classes.toolbar} />
      <div className={classes.mobileBackButton}>
        <IconButton onClick={() => toggleSidebar(layoutDispatch)} size="large">
          <ArrowBackIcon
            classes={{
              root: classNames(classes.headerIcon, classes.headerIconCollapse),
            }}
          />
        </IconButton>
      </div>
      <List className={classes.sidebarList}>
        {structure
          .filter((link) => permission(link.role, roles))
          .map((link) => (
            <SidebarLink
              key={link.id}
              isSidebarOpened={isSidebarOpened}
              {...link}
            />
          ))}
      </List>
    </Drawer>
  );

  function permission(linkRole, userRoles) {
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
    var breakpointWidth = theme.breakpoints.values.md;
    var isSmallScreen = windowWidth < breakpointWidth;

    if (isSmallScreen && isPermanent) {
      setPermanent(false);
    } else if (!isSmallScreen && !isPermanent) {
      setPermanent(true);
    }
  }
}

export default Sidebar;
