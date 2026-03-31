# Implementation Plan: `portal-view` and `controller-rs` Integration

This plan is based on the current `portal-view` UI and the initial `controller-rs` implementation.

## 1. Current State Summary

### `portal-view` today

The UI already has controller-oriented routes in [src/App.tsx](/home/steve/workspace/portal-view/src/App.tsx):

- `/app/controller/services`
- `/app/controller/check`
- `/app/controller/info`
- `/app/controller/logger`
- `/app/controller/loggerConfig`
- `/app/controller/logContent`
- `/app/controller/chaos`

These pages are built around legacy REST endpoints and address-based targeting:

- [src/pages/controller/CtrlPaneDashboard.tsx](/home/steve/workspace/portal-view/src/pages/controller/CtrlPaneDashboard.tsx) calls `GET /services`
- [src/pages/controller/HealthCheck.tsx](/home/steve/workspace/portal-view/src/pages/controller/HealthCheck.tsx) calls `GET /services/check/{id}`
- [src/pages/controller/ServerInfo.tsx](/home/steve/workspace/portal-view/src/pages/controller/ServerInfo.tsx) calls `GET /services/info`
- [src/pages/controller/LoggerConfig.tsx](/home/steve/workspace/portal-view/src/pages/controller/LoggerConfig.tsx) calls `GET /services/logger`
- [src/pages/controller/LogViewer.tsx](/home/steve/workspace/portal-view/src/pages/controller/LogViewer.tsx) calls `GET /services/logger` and `POST /services/logger/content`
- [src/pages/controller/ChaosMonkey.tsx](/home/steve/workspace/portal-view/src/pages/controller/ChaosMonkey.tsx) calls `/services/chaosmonkey`

The current frontend transport helper in [src/utils/fetchClient.ts](/home/steve/workspace/portal-view/src/utils/fetchClient.ts) supports HTTP fetch and JSON-RPC-over-HTTP bodies, but it does not manage WebSocket lifecycle, MCP requests, or pushed events.

The current frontend state model also has no controller-specific store. [src/contexts/AppContext.tsx](/home/steve/workspace/portal-view/src/contexts/AppContext.tsx) only carries a filter string, so there is nowhere yet to hold:

- live runtime instances
- MCP session state
- pushed controller events
- command progress / timeout state

There is also a codebase consistency issue: some controller pages already use `useLocation` and `useNavigate`, while others still depend on legacy route props like `props.location.state` and `props.history`. That should be corrected as part of this integration.

### `controller-rs` today

The controller is WebSocket-first and instance-targeted:

- internal runtime socket: `/ws/microservice`
- external MCP admin socket: `/ws/mcp`
- external pushed event socket: `/ws/portal-events`

Current MCP tools in [src/routes/mcp.rs](/home/steve/workspace/controller-rs/src/routes/mcp.rs):

- `list_services`
- `get_service`
- `get_service_info`
- `get_loggers`
- `set_loggers`
- `get_log_content`
- `get_modules`
- `reload_modules`
- `shutdown_service`
- `get_chaos_monkey`
- `configure_chaos_monkey`
- `run_chaos_monkey_assault`

Current pushed events in [src/events.rs](/home/steve/workspace/controller-rs/src/events.rs):

- `instance_connected`
- `instance_disconnected`
- `instance_updated`
- `command_completed`
- `command_failed`
- `command_timed_out`

The controller’s canonical target is `runtimeInstanceId`, not `(protocol, address, port)`.

## 2. Core Integration Decisions

### 2.1 Make `runtimeInstanceId` the Portal’s primary runtime key

The current portal controller pages pass node address/port through route state. That no longer matches the controller contract.

The Portal should treat `runtimeInstanceId` as the canonical identifier for:

- row selection
- detail navigation
- MCP tool execution
- event correlation

Address, port, protocol, version, and tags should become display metadata only.

### 2.2 Add a dedicated controller client layer

Do not bolt controller integration directly into existing page components.

Create a controller-specific frontend layer, for example:

- `src/controller/types.ts`
- `src/controller/mcpClient.ts`
- `src/controller/portalEventsClient.ts`
- `src/controller/controllerStore.ts`
- `src/contexts/ControllerContext.tsx`

Responsibilities:

- open and maintain the `/ws/mcp` socket through the gateway
- open and maintain the `/ws/portal-events` socket through the gateway
- handle reconnect/backoff
- issue MCP requests and correlate responses
- normalize live instance data into a shared store
- merge pushed events into the store
- expose command status and connection status to pages

### 2.3 Keep the existing controller routes, but replace the data flow underneath

The route inventory is already there and matches user expectations.

Recommended approach:

- keep the route paths in [src/App.tsx](/home/steve/workspace/portal-view/src/App.tsx)
- replace legacy REST calls with controller store/hooks
- migrate old route-prop pages to React Router hooks

### 2.4 Use pull plus push together

The Portal should not rely only on pushed events.

Recommended behavior:

- initial page load uses `list_services` and `get_service`
- command pages use targeted MCP tool calls
- `/ws/portal-events` keeps the dashboard live after initial hydration

## 3. Contract Gaps To Resolve Before UI Coding

### 3.1 Health check is not currently represented in `controller-rs`

The existing Portal route `/app/controller/check` expects a health-oriented operation, but the current controller MCP surface does not expose an equivalent tool.

Resolve this before coding:

1. add a `get_health` or `check_service` MCP tool to `controller-rs`, or
2. remove/merge the current Health Check page into `get_service` plus live connection status, or
3. keep a temporary legacy REST path during transition

This is the biggest contract mismatch today.

### 3.2 Lock the MCP result payload shapes for UI use

The current controller returns MCP `content[].json` payloads, but the UI plan needs stable result shapes for:

- `list_services`
- `get_service`
- `get_service_info`
- `get_loggers`
- `set_loggers`
- `get_log_content`
- chaos-monkey responses

Before UI implementation, define exact payload examples for each tool and keep them in the integration doc or controller README.

### 3.3 Lock the gateway-facing WebSocket URLs and forwarded identity headers

The plan assumes `portal-view` connects to the controller through gateway-routed WebSocket URLs and that the gateway forwards identity context expected by `controller-rs`.

Before coding, confirm:

- exact public WebSocket paths
- cookie/session behavior across the gateway
- any required CSRF or auth headers for WebSocket handshake
- how subject/roles headers reach `controller-rs`

## 4. Recommended Frontend Architecture

## Phase 0: Contract Lock

Before code changes in `portal-view`, finalize:

- whether health check remains a separate feature
- exact MCP tool result payloads
- exact `/ws/mcp` and `/ws/portal-events` gateway URLs
- auth expectations for both sockets
- whether disconnected-but-known instances should appear in Portal or only live ones

Deliverable:

- one short contract document with request/response examples and event examples

## Phase 1: Controller Client Foundation

Add a controller integration layer in `portal-view`.

Implement:

- MCP WebSocket client with request/response correlation
- Portal-events WebSocket client with auto-reconnect
- typed controller models:
  - `RuntimeInstance`
  - `PortalEvent`
  - `CommandState`
  - per-tool argument/result types
- controller context/store for:
  - instances by `runtimeInstanceId`
  - grouped service views by `serviceId` and `envTag`
  - selected instance
  - MCP connection state
  - portal-events connection state
  - pending commands

Recommended store shape:

```ts
type RuntimeInstanceId = string;

interface ControllerStore {
  instances: Record<RuntimeInstanceId, RuntimeInstance>;
  serviceIndex: Record<string, RuntimeInstanceId[]>;
  commandStates: Record<string, CommandState>;
  mcpStatus: "connecting" | "open" | "closed" | "error";
  eventsStatus: "connecting" | "open" | "closed" | "error";
}
```

## Phase 2: Dashboard Migration

Replace [src/pages/controller/CtrlPaneDashboard.tsx](/home/steve/workspace/portal-view/src/pages/controller/CtrlPaneDashboard.tsx).

Current behavior:

- fetches `/services`
- groups by `serviceId|tag`
- uses node address/port for actions

Target behavior:

- initial load uses `list_services`
- renders grouped rows by `serviceId` and `envTag`
- child rows are live runtime instances, each with:
  - `runtimeInstanceId`
  - address
  - port
  - version
  - environment
  - last seen
  - connected status
- actions navigate with `runtimeInstanceId`, not raw node address

Also add dashboard connection indicators:

- MCP connected / reconnecting / failed
- event stream connected / reconnecting / failed

## Phase 3: Detail and Command Page Migration

### 3.1 Server Info

Replace [src/pages/controller/ServerInfo.tsx](/home/steve/workspace/portal-view/src/pages/controller/ServerInfo.tsx) so it:

- reads `runtimeInstanceId` from route state or route params
- calls `get_service_info`
- renders structured result data and command errors

### 3.2 Logger Pages

Update:

- [src/pages/controller/LogViewer.tsx](/home/steve/workspace/portal-view/src/pages/controller/LogViewer.tsx)
- [src/pages/controller/LoggerConfig.tsx](/home/steve/workspace/portal-view/src/pages/controller/LoggerConfig.tsx)
- [src/pages/controller/LogContent.tsx](/home/steve/workspace/portal-view/src/pages/controller/LogContent.tsx)

Map them to:

- `get_loggers`
- `set_loggers`
- `get_log_content`

Design correction:

- `LogContent.tsx` is currently a placeholder; implement it for actual structured log results or remove the route and keep log content inside `LogViewer`

### 3.3 Chaos Monkey

Update [src/pages/controller/ChaosMonkey.tsx](/home/steve/workspace/portal-view/src/pages/controller/ChaosMonkey.tsx) and its form components to use:

- `get_chaos_monkey`
- `configure_chaos_monkey`
- `run_chaos_monkey_assault`

Design correction:

- stop constructing URLs from `protocol/address/port`
- submit MCP tool calls using `runtimeInstanceId`

### 3.4 Health Check

Implement only after the contract gap is closed.

If a new MCP health tool is added, migrate [src/pages/controller/HealthCheck.tsx](/home/steve/workspace/portal-view/src/pages/controller/HealthCheck.tsx) to that tool. Otherwise, deprecate this route and fold its purpose into the instance detail view.

## Phase 4: Real-Time Event Integration

Wire `/ws/portal-events` into the controller store.

Expected behavior:

- `instance_connected` inserts or updates a live row
- `instance_disconnected` marks the row offline immediately
- `instance_updated` refreshes metadata
- `command_completed`, `command_failed`, and `command_timed_out` update command state and show toast/snackbar notifications

UI effects:

- dashboard updates live without refresh
- detail page badges update when instances disconnect
- command results can appear in-page and as toast feedback

## Phase 5: Route-State and Component Cleanup

Normalize the controller pages on React Router hooks and typed route state.

Specifically:

- remove legacy `props.location.state` usage
- remove legacy `props.history` usage
- use `useLocation`, `useNavigate`, and preferably route params for detail pages
- define one typed navigation payload for controller pages

Recommended route parameter direction:

- `/app/controller/services`
- `/app/controller/instance/:runtimeInstanceId/info`
- `/app/controller/instance/:runtimeInstanceId/logger`
- `/app/controller/instance/:runtimeInstanceId/chaos`

It is acceptable to keep current route paths for phase 1 and switch to parameterized routes in phase 2 if that reduces migration risk.

## Phase 6: Error Handling and UX Hardening

Add clear UX for:

- MCP socket disconnected
- portal-events socket disconnected
- command timeout
- target instance disconnected mid-command
- stale route state / missing runtime instance

Recommended UX:

- top-level connection status banner in controller pages
- inline command-state panel for active operations
- snackbar for command completion/failure/timeout
- “instance is offline” state when a page is open for a disconnected runtime

## Phase 7: Testing

`portal-view` currently has no visible automated test layer for this area. Add one before or during migration.

Recommended tests:

- unit tests for MCP request/response correlation adapter
- unit tests for portal-events reducer/store updates
- component tests for:
  - dashboard initial render from `list_services`
  - dashboard update after `instance_connected` event
  - logger config update flow
  - chaos-monkey command flow
- integration test for disconnected-instance handling

If feasible, add browser-level tests for:

- dashboard live updates
- server info request
- logger update
- command timeout presentation

## 5. Proposed File-Level Work Breakdown

Recommended new frontend files:

- `src/controller/types.ts`
- `src/controller/mcpClient.ts`
- `src/controller/portalEventsClient.ts`
- `src/controller/controllerReducer.ts`
- `src/controller/useControllerCommand.ts`
- `src/contexts/ControllerContext.tsx`

Recommended touched files:

- [src/App.tsx](/home/steve/workspace/portal-view/src/App.tsx)
- [src/utils/fetchClient.ts](/home/steve/workspace/portal-view/src/utils/fetchClient.ts) only if you want shared auth/header helpers reused by socket setup
- [src/pages/controller/CtrlPaneDashboard.tsx](/home/steve/workspace/portal-view/src/pages/controller/CtrlPaneDashboard.tsx)
- [src/pages/controller/HealthCheck.tsx](/home/steve/workspace/portal-view/src/pages/controller/HealthCheck.tsx)
- [src/pages/controller/ServerInfo.tsx](/home/steve/workspace/portal-view/src/pages/controller/ServerInfo.tsx)
- [src/pages/controller/LogViewer.tsx](/home/steve/workspace/portal-view/src/pages/controller/LogViewer.tsx)
- [src/pages/controller/LoggerConfig.tsx](/home/steve/workspace/portal-view/src/pages/controller/LoggerConfig.tsx)
- [src/pages/controller/LogContent.tsx](/home/steve/workspace/portal-view/src/pages/controller/LogContent.tsx)
- [src/pages/controller/ChaosMonkey.tsx](/home/steve/workspace/portal-view/src/pages/controller/ChaosMonkey.tsx)

## 6. Delivery Sequence

Recommended implementation order:

1. lock controller/portal contracts, especially health check
2. add MCP + portal-events client layer
3. migrate dashboard to `list_services`
4. migrate server info and logger pages
5. migrate chaos-monkey pages
6. wire pushed events and live command status
7. clean up legacy route-prop usage
8. add automated tests and hardening

## 7. Bottom Line

This integration is not a simple transport swap.

The current portal controller UI is built around:

- REST fetches
- address/port targeting
- mostly pull-based refresh

The new controller is built around:

- MCP over WebSocket
- `runtimeInstanceId` targeting
- pushed real-time events

The right implementation plan is therefore:

- add a controller-specific client/store layer first
- migrate existing controller pages onto that layer
- standardize on `runtimeInstanceId`
- use portal events to keep the dashboard and command state live
- close the health-check contract gap before starting page migration
