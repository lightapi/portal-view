import { useCallback, useEffect, useMemo, useState } from "react";
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
    Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddBoxIcon from "@mui/icons-material/AddBox";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Widget from "../../components/Widget/Widget";
import fetchClient from "../../utils/fetchClient";
import { useUserState } from "../../contexts/UserContext";
import TaskActionPanel from "../../tasks/TaskActionPanel";
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from "../../tasks/taskUtils";

// --- Type Definitions ---
type ActionType = {
    actionClassName?: string;
};

type RuleType = {
    hostId?: string;
    ruleId: string;
    ruleName?: string;
    ruleType?: string;
    common?: string;
    conditionLanguage?: "cel" | string;
    conditionSecurityProfile?: "strict" | "standard" | "internal-admin" | string;
    expression?: string;
    version?: string;
    ruleBody?: string;
    author?: string;
    ruleDesc?: string;
    actions?: ActionType[];
    updateUser?: string;
    updateTs?: string;
    aggregateVersion?: number;
    active: boolean;
};

type RuleTestCaseType = {
    hostId?: string;
    ruleId: string;
    testId: string;
    testName: string;
    testDesc?: string;
    executorType?: "java" | "rust" | "both";
    testMode?: "conditions" | "full";
    inputContext?: Record<string, unknown>;
    expectedResult?: boolean;
    expectedOutputs?: Record<string, unknown>;
    updateUser?: string;
    updateTs?: string;
    aggregateVersion?: number;
    active?: boolean;
};

type RuleTestCaseResponse = {
    testCases: RuleTestCaseType[];
    total: number;
};

type UserState = {
    host?: string;
};

export default function RuleDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
    const [testCases, setTestCases] = useState<RuleTestCaseType[]>([]);
    const [testCaseError, setTestCaseError] = useState(false);
    const [runningTestId, setRunningTestId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, unknown>>({});

    // Data passed from RuleAdmin via navigate state
    const rule = (location.state as { rule?: RuleType } | null)?.rule;

    // Parse ruleBody if it exists but expression/actions are missing (optional fallback)
    let ruleData: Partial<RuleType> = rule ? { ...rule } : {};
    if (rule?.ruleBody && (!rule.expression || !rule.actions)) {
        try {
            const bodyObj = JSON.parse(rule.ruleBody);
            ruleData = { ...ruleData, ...bodyObj };
        } catch (e) {
            console.error("Failed to parse ruleBody in Detail page:", e);
        }
    }
    ruleData.conditionLanguage = ruleData.conditionLanguage ?? "cel";
    if (!ruleData.conditionSecurityProfile) {
        ruleData.conditionSecurityProfile = "strict";
    }
    const taskContext = useMemo(
        () => mergeTaskContext(searchContext, {
            hostId: host ?? ruleData.hostId ?? "",
            ruleId: ruleData.ruleId ?? "",
        }),
        [host, ruleData.hostId, ruleData.ruleId, searchContext],
    );

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
        { label: "Rule Type", value: ruleData.ruleType },
        { label: "Condition Language", value: ruleData.conditionLanguage },
        { label: "Condition Security Profile", value: ruleData.conditionSecurityProfile },
        { label: "Common", value: ruleData.common },
        { label: "Version", value: ruleData.version },
        { label: "Author", value: ruleData.author },
        { label: "Host ID", value: ruleData.hostId },
        { label: "Status", value: ruleData.active ? "Active" : "Inactive" },
        { label: "Last Updated By", value: ruleData.updateUser },
        { label: "Last Updated At", value: ruleData.updateTs },
    ];

    const fetchTestCases = useCallback(async () => {
        if (!ruleData.ruleId) return;
        const cmd = {
            host: "lightapi.net",
            service: "rule",
            action: "getRuleTestCase",
            version: "0.1.0",
            data: {
                hostId: host ?? ruleData.hostId,
                ruleId: ruleData.ruleId,
                offset: 0,
                limit: 50,
                sorting: "[]",
                filters: "[]",
                globalFilter: "",
                active: true,
            },
        };
        const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
        try {
            const json = await fetchClient(url) as RuleTestCaseResponse;
            setTestCases(json.testCases || []);
            setTestCaseError(false);
        } catch (error) {
            console.error("Failed to fetch rule test cases:", error);
            setTestCaseError(true);
        }
    }, [host, ruleData.hostId, ruleData.ruleId]);

    useEffect(() => {
        fetchTestCases();
    }, [fetchTestCases]);

    const handleCreateTestCase = () => {
        navigate(buildTaskAwareRoute("/app/form/createRuleTestCase", searchParams, taskContext), {
            state: {
                data: {
                    hostId: host ?? ruleData.hostId,
                    ruleId: ruleData.ruleId,
                    executorType: "java",
                    testMode: "conditions",
                    inputContext: "{}",
                    expectedResult: true,
                    expectedOutputs: "{}",
                },
                source: location.pathname,
            },
        });
    };

    const handleRunTestCase = async (testCase: RuleTestCaseType) => {
        setRunningTestId(testCase.testId);
        const cmd = {
            host: "lightapi.net",
            service: "rule",
            action: "runRuleTestCase",
            version: "0.1.0",
            data: {
                hostId: testCase.hostId ?? host ?? ruleData.hostId,
                ruleId: testCase.ruleId,
                testId: testCase.testId,
                executorType: testCase.executorType,
                testMode: testCase.testMode,
            },
        };
        const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
        try {
            const json = await fetchClient(url) as unknown;
            setTestResults((prev) => ({ ...prev, [testCase.testId]: json }));
        } catch (error) {
            console.error("Failed to run rule test case:", error);
            setTestResults((prev) => ({ ...prev, [testCase.testId]: { success: false, error: String(error) } }));
        } finally {
            setRunningTestId(null);
        }
    };

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

    return (
        <Box p={2}>
            <TaskActionPanel
                title="Schema and Rule Tasks"
                context={taskContext}
                taskIds={["manage-schema-rules"]}
                maxActions={3}
            />

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

            <Widget
              title="Rule Detail"
              upperTitle
              sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
              bodySx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}
            >
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

                {ruleData.expression && renderSection("CEL Expression", (
                    <Paper sx={{ p: 2, backgroundColor: '#f7f7f7', overflowX: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {ruleData.expression}
                        </pre>
                    </Paper>
                ))}

                {/* Actions Section */}
                {ruleData.actions && ruleData.actions.length > 0 && renderSection("Actions", (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableBody>
                                {ruleData.actions.map((action, idx) => (
                                    <TableRow key={action.actionClassName || idx} hover sx={{ verticalAlign: 'top' }}>
                                        <TableCell sx={{ width: '40px', fontWeight: 'bold' }}>{idx + 1}</TableCell>
                                        <TableCell>
                                            <Box mt={1} display="flex" gap={2} flexDirection="column">
                                                <Typography variant="caption"><strong>Action Class:</strong> <code>{action.actionClassName}</code></Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ))}

                {renderSection("Test Cases", (
                    <Box>
                        <Box mb={2} display="flex" justifyContent="flex-end">
                            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={handleCreateTestCase}>
                                Add Test Case
                            </Button>
                        </Box>
                        {testCaseError && (
                            <Typography color="error" mb={2}>Unable to load rule test cases.</Typography>
                        )}
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                            <Table size="small">
                                <TableBody>
                                    {testCases.length === 0 && (
                                        <TableRow>
                                            <TableCell>No test cases have been defined for this rule.</TableCell>
                                        </TableRow>
                                    )}
                                    {testCases.map((testCase) => (
                                        <TableRow key={testCase.testId} hover sx={{ verticalAlign: 'top' }}>
                                            <TableCell sx={{ width: '30%' }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{testCase.testName}</Typography>
                                                <Typography variant="caption" color="textSecondary">{testCase.testId}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box display="flex" gap={1} mb={1}>
                                                    <Chip size="small" label={testCase.executorType || "java"} />
                                                    <Chip size="small" label={testCase.testMode || "conditions"} />
                                                    <Chip size="small" color={testCase.expectedResult ? "success" : "default"} label={`expected: ${String(testCase.expectedResult ?? "N/A")}`} />
                                                </Box>
                                                {testCase.testDesc && (
                                                    <Typography variant="body2" color="textSecondary">{testCase.testDesc}</Typography>
                                                )}
                                                <Typography variant="caption" component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {JSON.stringify(testCase.inputContext ?? {}, null, 2)}
                                                </Typography>
                                                <Box mt={1}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<PlayArrowIcon />}
                                                        disabled={runningTestId === testCase.testId}
                                                        onClick={() => handleRunTestCase(testCase)}
                                                    >
                                                        {runningTestId === testCase.testId ? "Running" : "Run"}
                                                    </Button>
                                                </Box>
                                                {testResults[testCase.testId] !== undefined && (
                                                    <Typography variant="caption" component="pre" sx={{ mt: 1, p: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', backgroundColor: '#f7f7f7' }}>
                                                        {JSON.stringify(testResults[testCase.testId], null, 2)}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
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
