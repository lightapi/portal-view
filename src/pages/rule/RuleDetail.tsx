import { useNavigate, useLocation } from "react-router-dom";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    Paper,
    Button,
    Box,
    Typography,
    Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Widget from "../../components/Widget/Widget";
import useStyles from "./styles";

// --- Type Definitions ---
type ConditionType = {
    conditionId: string;
    conditionDesc?: string;
    operatorCode?: string;
    propertyPath?: string;
    index?: number;
};

type ActionType = {
    actionId: string;
    actionDesc?: string;
    conditionResult?: boolean;
    actionClassName?: string;
};

type RuleType = {
    hostId?: string;
    ruleId: string;
    ruleName?: string;
    ruleVersion?: string;
    ruleType?: string;
    ruleGroup?: string;
    common?: string;
    ruleBody?: string;
    ruleOwner?: string;
    ruleDesc?: string;
    conditions?: ConditionType[];
    actions?: ActionType[];
    updateUser?: string;
    updateTs?: string;
    aggregateVersion?: number;
    active: boolean;
};

export default function RuleDetail() {
    const classes = useStyles();
    const location = useLocation();
    const navigate = useNavigate();

    // Data passed from RuleAdmin via navigate state
    const { rule } = location.state as { rule: RuleType };

    if (!rule) {
        return (
            <Box p={3}>
                <Typography color="error">No rule data available.</Typography>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                    Go Back
                </Button>
            </Box>
        );
    }

    // Parse ruleBody if it exists but conditions/actions are missing (optional fallback)
    let ruleData = { ...rule };
    if (rule.ruleBody && (!rule.conditions || !rule.actions)) {
        try {
            const bodyObj = JSON.parse(rule.ruleBody);
            ruleData = { ...ruleData, ...bodyObj };
        } catch (e) {
            console.error("Failed to parse ruleBody in Detail page:", e);
        }
    }

    const renderSection = (title: string, content: React.ReactNode) => (
        <Box mb={4}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {title}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {content}
        </Box>
    );

    const mainProperties = [
        { label: "Rule ID", value: ruleData.ruleId },
        { label: "Rule Name", value: ruleData.ruleName },
        { label: "Rule Version", value: ruleData.ruleVersion },
        { label: "Rule Type", value: ruleData.ruleType },
        { label: "Group", value: ruleData.ruleGroup },
        { label: "Owner", value: ruleData.ruleOwner },
        { label: "Host ID", value: ruleData.hostId },
        { label: "Common", value: ruleData.common },
        { label: "Status", value: ruleData.active ? "Active" : "Inactive" },
        { label: "Last Updated By", value: ruleData.updateUser },
        { label: "Last Updated At", value: ruleData.updateTs },
    ];

    return (
        <Box p={2}>
            <Box mb={2} display="flex" justifyContent="flex-start">
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    sx={{ borderRadius: 2 }}
                >
                    Back to Rules
                </Button>
            </Box>

            <Widget title="Rule Detail" upperTitle className={classes.card}>
                {/* Description Section */}
                {ruleData.ruleDesc && renderSection("Description", (
                    <Typography variant="body1">{ruleData.ruleDesc}</Typography>
                ))}

                {/* Core Properties Section */}
                {renderSection("Basic Information", (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableBody>
                                {mainProperties.map((prop) => (
                                    <TableRow key={prop.label} hover>
                                        <TableCell sx={{ fontWeight: 'bold', width: '30%', backgroundColor: '#fafafa' }}>
                                            {prop.label}
                                        </TableCell>
                                        <TableCell>{String(prop.value || "N/A")}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ))}

                {/* Conditions Section */}
                {ruleData.conditions && ruleData.conditions.length > 0 && renderSection("Conditions", (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableBody>
                                {ruleData.conditions.map((condition, idx) => (
                                    <TableRow key={condition.conditionId || idx} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell sx={{ width: '40px', fontWeight: 'bold' }}>{condition.index || idx + 1}</TableCell>
                                        <TableCell>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{condition.conditionId}</Typography>
                                            <Typography variant="body2" color="textSecondary">{condition.conditionDesc}</Typography>
                                            <Box mt={1} display="flex" gap={2}>
                                                <Typography variant="caption"><strong>Operator:</strong> {condition.operatorCode}</Typography>
                                                <Typography variant="caption"><strong>Path:</strong> {condition.propertyPath}</Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ))}

                {/* Actions Section */}
                {ruleData.actions && ruleData.actions.length > 0 && renderSection("Actions", (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableBody>
                                {ruleData.actions.map((action, idx) => (
                                    <TableRow key={action.actionId || idx} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell sx={{ width: '40px', fontWeight: 'bold' }}>{idx + 1}</TableCell>
                                        <TableCell>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{action.actionId}</Typography>
                                            <Typography variant="body2" color="textSecondary">{action.actionDesc}</Typography>
                                            <Box mt={1} display="flex" gap={2} flexDirection="column">
                                                <Typography variant="caption"><strong>Condition Result Required:</strong> {String(action.conditionResult)}</Typography>
                                                <Typography variant="caption"><strong>Action Class:</strong> <code>{action.actionClassName}</code></Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ))}

                {/* JSON Raw Body - Optional and useful for debugging or detailed inspection */}
                {ruleData.ruleBody && renderSection("Raw Configuration (JSON)", (
                    <Paper sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#d4d4d4', overflowX: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '12px' }}>
                            {JSON.stringify(JSON.parse(ruleData.ruleBody), null, 2)}
                        </pre>
                    </Paper>
                ))}
            </Widget>
        </Box>
    );
}
