import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import React, { useEffect, useRef } from 'react';
import PageTitle from '../../components/PageTitle/PageTitle';
import Dot from '../../components/Sidebar/components/Dot';
import Widget from '../../components/Widget/Widget';
import { Typography } from '../../components/Wrappers/Wrappers';
import { useUserDispatch, useUserState, signOut } from '../../contexts/UserContext';
import { useLocation, useNavigate } from 'react-router-dom';
import SensorsIcon from '@mui/icons-material/Sensors';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SpeedIcon from '@mui/icons-material/Speed';
import HistoryIcon from '@mui/icons-material/History';
import ShieldIcon from '@mui/icons-material/Shield';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LoginIcon from '@mui/icons-material/Login';
import ExploreIcon from '@mui/icons-material/Explore';
import InfoIcon from '@mui/icons-material/Info';
import {
  Card,
  CardContent,
  Stack,
  Avatar,
  LinearProgress,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';

// Mock Data Types
interface ActivityEvent {
  id: string;
  type: 'registration' | 'execution' | 'security' | 'system';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info' | 'error';
}

const MOCK_ACTIVITY: ActivityEvent[] = [
  { id: '1', type: 'registration', message: "New MCP Server 'Inventory-Service' registered successfully.", timestamp: '2 mins ago', status: 'success' },
  { id: '2', type: 'execution', message: "Agent 'Support-Bot' resolved query using 'Payment-Tool'.", timestamp: '15 mins ago', status: 'success' },
  { id: '3', type: 'security', message: "Data-Privacy-v2 policy enforced on 4 agents.", timestamp: '1 hour ago', status: 'info' },
  { id: '4', type: 'system', message: "Gateway node 'us-east-1' auto-scaled to 3 instances.", timestamp: '2 hours ago', status: 'info' },
  { id: '5', type: 'security', message: "Unauthorized access attempt blocked from IP 192.168.1.45.", timestamp: '3 hours ago', status: 'warning' },
];

const MOCK_STATS = [
  { title: 'Fabric Status', value: 'Healthy', icon: <SensorsIcon />, color: '#4caf50', subtext: '99.9% Uptime' },
  { title: 'Active Agents', value: '12', icon: <GroupsIcon />, color: '#2196f3', subtext: '+2 in last 24h' },
  { title: 'MCP Tools', value: '48', icon: <BuildIcon />, color: '#ff9800', subtext: 'across 6 servers' },
  { title: 'Avg Latency', value: '42ms', icon: <SpeedIcon />, color: '#f44336', subtext: '-5ms improvement' },
];

const QUICK_ACTIONS = [
  { label: 'Onboard MCP', icon: <AddCircleIcon />, color: 'primary' },
  { label: 'Configure Agent', icon: <SettingsIcon />, color: 'secondary' },
  { label: 'Manage Memory', icon: <StorageIcon />, color: 'info' },
  { label: 'Security Logs', icon: <VerifiedUserIcon />, color: 'warning' },
];

const StatCard = ({ title, value, icon, color, subtext }: any) => {
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            width: 56,
            height: 56
          }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5 }}>
              {value}
            </Typography>
            <Typography variant="caption" sx={{ color: color, fontWeight: 600 }}>
              {subtext}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        bgcolor: color,
        opacity: 0.6
      }} />
    </Card>
  );
};

const ActivityStream = () => {
  const columns = React.useMemo<MRT_ColumnDef<ActivityEvent>[]>(
    () => [
      {
        accessorKey: 'type',
        header: 'Type',
        size: 100,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem' }}
          />
        ),
      },
      {
        accessorKey: 'message',
        header: 'Event Description',
      },
      {
        accessorKey: 'timestamp',
        header: 'Time',
        size: 120,
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns,
    data: MOCK_ACTIVITY,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enablePagination: false,
    enableSorting: false,
    muiTablePaperProps: {
      elevation: 0,
      sx: { borderRadius: 0 },
    },
    muiTableBodyCellProps: {
      sx: { fontSize: '0.875rem' },
    },
  });

  return <MaterialReactTable table={table} />;
};

const UserDashboard = ({ email }: { email: string | null }) => {
  return (
    <Box sx={{ mt: 4, px: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
            Light-Fabric Control
          </Typography>
          <Typography variant="h6" color="textSecondary">
            Welcome back, <Box component="span" sx={{ color: 'secondary.main', fontWeight: 700 }}>{email || 'User'}</Box>. Orchestrating the Agentic Future.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<HistoryIcon />}>View Logs</Button>
          <Button variant="contained" color="primary" startIcon={<AddCircleIcon />}>New Agent</Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Stats Row */}
        {MOCK_STATS.map((stat, idx) => (
          <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard {...stat} />
          </Grid>
        ))}

        {/* Main Content Area */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Widget
            title="Live Fabric Activity"
            noBodyPadding
            header={
              <Stack direction="row" spacing={1} alignItems="center">
                <HistoryIcon color="action" />
                <Typography variant="h6">Live Fabric Activity</Typography>
              </Stack>
            }
          >
            <ActivityStream />
          </Widget>
        </Grid>

        {/* Sidebar Actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Widget title="Quick Operations">
              <Grid container spacing={2}>
                {QUICK_ACTIONS.map((action, idx) => (
                  <Grid key={idx} size={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color={action.color as any}
                      sx={{
                        height: 100,
                        flexDirection: 'column',
                        gap: 1,
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        '&:hover': { borderWidth: 2 }
                      }}
                    >
                      {action.icon}
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {action.label}
                      </Typography>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Widget>

            <Widget title="Compliance Score">
              <Box sx={{ py: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>Security Posture</Typography>
                  <Typography variant="body2" color="success.main" fontWeight={700}>85%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={85} color="success" sx={{ height: 8, borderRadius: 4 }} />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                  4 policy updates pending for Agent-Delta.
                </Typography>
              </Box>
            </Widget>

            <Widget title="Ecosystem Overview">
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box sx={{ p: 2, bgcolor: alpha('#2196f3', 0.05), borderRadius: 2, border: '1px solid', borderColor: alpha('#2196f3', 0.1) }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <AccountTreeIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2">Primary Gateway</Typography>
                      <Typography variant="caption" color="textSecondary">loc.lightapi.net (Healthy)</Typography>
                    </Box>
                  </Stack>
                </Box>
                <Box sx={{ p: 2, bgcolor: alpha('#9c27b0', 0.05), borderRadius: 2, border: '1px solid', borderColor: alpha('#9c27b0', 0.1) }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VerifiedUserIcon color="secondary" />
                    <Box>
                      <Typography variant="subtitle2">Auth Provider</Typography>
                      <Typography variant="caption" color="textSecondary">OAuth2 Kafka-based (Active)</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Widget>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

const GuestDashboard = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ mt: 8, px: 2, textAlign: 'center' }}>
      <Box sx={{ mb: 10 }}>
        <Typography variant="h1" sx={{
          fontWeight: 900,
          fontSize: { xs: '3rem', md: '5rem' },
          background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2
        }}>
          Light-Fabric
        </Typography>
        <Typography variant="h4" color="textSecondary" sx={{ mb: 6, fontWeight: 400 }}>
          The Enterprise-Grade Agentic Orchestration Platform
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={() => navigate('/login')}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: '12px' }}
          >
            Get Started
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<ExploreIcon />}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: '12px' }}
            href="https://www.networknt.com/light-fabric/"
            target="_blank"
          >
            Documentation
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Widget title="AI Gateway" header={<Avatar sx={{ bgcolor: 'primary.main', mb: 1 }}><SensorsIcon /></Avatar>}>
            <Typography color="textSecondary">
              High-performance Rust-based gateway for secure and governed AI interactions.
            </Typography>
          </Widget>
        </Grid>
        <Grid item xs={12} md={4}>
          <Widget title="Agent Ecosystem" header={<Avatar sx={{ bgcolor: 'secondary.main', mb: 1 }}><GroupsIcon /></Avatar>}>
            <Typography color="textSecondary">
              Seamlessly onboard and orchestrate MCP servers and specialized agents.
            </Typography>
          </Widget>
        </Grid>
        <Grid item xs={12} md={4}>
          <Widget title="Hindsight Memory" header={<Avatar sx={{ bgcolor: 'info.main', mb: 1 }}><StorageIcon /></Avatar>}>
            <Typography color="textSecondary">
              Shared organizational and user memory banks for context-aware intelligence.
            </Typography>
          </Widget>
        </Grid>
      </Grid>

      <Box sx={{ mt: 10, py: 6, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" color="textSecondary" sx={{ mb: 4 }}>
          Connect with the Community
        </Typography>
        <Stack direction="row" spacing={4} justifyContent="center">
          <Link href="https://github.com/networknt" target="_blank" color="inherit">GitHub</Link>
          <Link href="https://www.youtube.com/channel/UCHCRMWJVXw8iB7zKxF55Byw" target="_blank" color="inherit">YouTube</Link>
          <Link href="https://gitter.im/networknt/light-portal" target="_blank" color="inherit">Gitter</Link>
        </Stack>
      </Box>
    </Box>
  );
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const userDispatch = useUserDispatch();
  const { isAuthenticated, email } = useUserState();
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

  return isAuthenticated ? <UserDashboard email={email} /> : <GuestDashboard />;
}
