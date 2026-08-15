export type WorkflowStepTemplate = {
    id: string;
    label: string;
    detail: string;
    defaultStepId: string;
    build: (stepId: string) => string;
};

export const workflowStepTemplates: WorkflowStepTemplate[] = [
    {
        id: 'ask',
        label: 'Ask',
        detail: 'Human task',
        defaultStepId: 'ask-input',
        build: stepId => `  - ${stepId}:\n      ask:\n        prompt: Provide workflow input.\n        mode: text\n`,
    },
    {
        id: 'assert',
        label: 'Assert',
        detail: 'Validation',
        defaultStepId: 'assert-output',
        build: stepId => `  - ${stepId}:\n      assert:\n        path: $.status\n        equals: ok\n`,
    },
    {
        id: 'http',
        label: 'HTTP Call',
        detail: 'HTTP call',
        defaultStepId: 'call-http',
        build: stepId => `  - ${stepId}:\n      call: http\n      with:\n        method: GET\n        endpoint:\n          uri: https://api.example.com/resource\n        output: content\n`,
    },
    {
        id: 'openapi',
        label: 'Endpoint',
        detail: 'OpenAPI call',
        defaultStepId: 'call-endpoint',
        build: stepId => `  - ${stepId}:\n      openapi:\n        endpointId: endpoint_id\n        arguments: {}\n`,
    },
    {
        id: 'jsonrpc',
        label: 'JSON-RPC Call',
        detail: 'JSON-RPC call',
        defaultStepId: 'call-jsonrpc',
        build: stepId => `  - ${stepId}:\n      call: jsonrpc\n      with:\n        endpoint:\n          uri: https://api.example.com/rpc\n        method: method_name\n        params: {}\n        output: result\n`,
    },
    {
        id: 'openrpc',
        label: 'OpenRPC Call',
        detail: 'OpenRPC call',
        defaultStepId: 'call-openrpc',
        build: stepId => `  - ${stepId}:\n      call: openrpc\n      with:\n        document:\n          endpoint:\n            uri: https://api.example.com/openrpc.json\n        method: method_name\n        params: {}\n        output: result\n`,
    },
    {
        id: 'grpc',
        label: 'gRPC Call',
        detail: 'gRPC call',
        defaultStepId: 'call-grpc',
        build: stepId => `  - ${stepId}:\n      call: grpc\n      with:\n        proto:\n          endpoint:\n            uri: https://api.example.com/service.proto\n        service:\n          name: ServiceName\n          host: api.example.com\n          port: 443\n        method: MethodName\n        arguments: {}\n`,
    },
    {
        id: 'mcp',
        label: 'MCP Tool',
        detail: 'MCP tool',
        defaultStepId: 'call-tool',
        build: stepId => `  - ${stepId}:\n      mcp:\n        tool: tool_name\n        arguments: {}\n`,
    },
    {
        id: 'rule',
        label: 'Rule',
        detail: 'Rule check',
        defaultStepId: 'check-rule',
        build: stepId => `  - ${stepId}:\n      rule:\n        ruleId: rule_id\n        input: {}\n`,
    },
    {
        id: 'agent',
        label: 'Agent',
        detail: 'Agent task',
        defaultStepId: 'delegate-agent',
        build: stepId => `  - ${stepId}:\n      agent:\n        agentDefId: agent_def_id\n        input: {}\n`,
    },
    {
        id: 'workflow',
        label: 'Workflow',
        detail: 'Child workflow',
        defaultStepId: 'call-workflow',
        build: stepId => `  - ${stepId}:\n      workflow:\n        wfDefId: workflow_definition_id\n        input: {}\n`,
    },
    {
        id: 'fork',
        label: 'Fork',
        detail: 'Parallel branches',
        defaultStepId: 'parallel-work',
        build: stepId => `  - ${stepId}:\n      fork:\n        branches:\n          - branchOne:\n              set:\n                value: "\${ .value }"\n          - branchTwo:\n              set:\n                value: "\${ .value }"\n        compete: false\n      export:\n        as:\n          results: .output\n`,
    },
    {
        id: 'switch',
        label: 'Switch',
        detail: 'Branch',
        defaultStepId: 'branch',
        build: stepId => `  - ${stepId}:\n      switch:\n        - when: \${ .status == "ok" }\n          then: next-step\n        - else: fallback-step\n`,
    },
    {
        id: 'condition',
        label: 'Condition',
        detail: 'Conditional guard',
        defaultStepId: 'check-condition',
        build: stepId => `  - ${stepId}:\n      switch:\n        - matched:\n            when: .condition == true\n            then: next-step\n        - default:\n            then: fallback-step\n`,
    },
    {
        id: 'set',
        label: 'Set',
        detail: 'Context update',
        defaultStepId: 'set-values',
        build: stepId => `  - ${stepId}:\n      set:\n        value: "\${ .value }"\n`,
    },
    {
        id: 'export',
        label: 'Export',
        detail: 'Output mapping',
        defaultStepId: 'export-output',
        build: stepId => `  - ${stepId}:\n      set:\n        value: "\${ .value }"\n      export:\n        as:\n          result: .output.value\n`,
    },
    {
        id: 'wait',
        label: 'Wait',
        detail: 'Durable wait',
        defaultStepId: 'wait-for-event',
        build: stepId => `  - ${stepId}:\n      wait:\n        duration: PT5M\n`,
    },
];

export function normalizeWorkflowStepId(value: string, fallback: string): string {
    const normalized = value.trim()
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}
