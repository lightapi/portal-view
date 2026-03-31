# Controller and Portal-View Integration Plan

This document outlines the architecture and implementation steps to integrate the `light-portal` (specifically the `portal-view` React frontend) with the `light-controller` (both Java and Rust implementations) using real-time WebSockets and the Model Context Protocol (MCP).

## 1. Overview

The integration aims to replace legacy REST-based polling with a persistent, event-driven Control Plane. 

- **Control Plane Sockets:** The Portal will manage two permanent WebSocket connections to the controller via the `light-gateway` (BFF).
- **Service Registration/Deregistration:** The Dashboard updates in real-time as services connect/disconnect.
- **Administrative Commands:** Tasks like changing log levels or reloading configuration are issued as RPC calls via MCP over WebSocket.

---

## 2. Technical Architecture

### 2.1 Communication Channels

| Channel | URL Path (via BFF) | Protocol | Purpose |
| :--- | :--- | :--- | :--- |
| **Portal Events** | `/ws/portal-events` | JSON Events | Real-time notifications of instance status changes. |
| **MCP Admin** | `/ws/mcp` | JSON-RPC 2.0 (MCP) | Request/Response for administrative tools (info, logger, etc.). |

### 2.2 Shared Application State

A new `ControllerContext` will be introduced to maintain the live state of the network.

- **Data Store:**
  - `instances`: Map of `RuntimeInstanceId` -> `RuntimeInstanceType`.
  - `connectionStatus`: Tracking health of the WebSocket connections.
  - `pendingCommands`: Tracking active RPC requests.

---

## 3. Implementation Phases

### Phase 1: Controller Client Foundation

Implement the low-level infrastructure for WebSocket management.

- **`mcpClient.ts`**:
  - Implement JSON-RPC 2.0 request/response correlation using IDs.
  - Support `tools/list` and `tools/call`.
- **`portalEventsClient.ts`**:
  - Handle `instance_connected`, `instance_disconnected`, `instance_updated`.
  - Implement Exponential Backoff with Jitter for reconnection recovery.

### Phase 2: Dashboard Migration (`CtrlPaneDashboard.tsx`)

Transition the primary dashboard from static fetching to live updates.

- **Initial Hydration:** Fetch the current state using the `list_services` MCP tool on startup.
- **Live Updates:** Merge incoming portal events into the `instances` store.
- **UI Interaction:** Ensure all actions (Check, Info, Logger, Chaos) use `runtimeInstanceId` as the primary key.

### Phase 3: Command Page Migration

Refactor existing command-oriented pages to use the `mcpClient`.

- **`ServerInfo.tsx`**: Replace REST call with `get_service_info` tool call.
- **`LoggerConfig.tsx`**: Replace REST calls with `get_loggers` and `set_loggers`.
- **`ChaosMonkey.tsx`**: Replace REST calls with `chaos_monkey` assault/config tools.

---

## 4. Proposed File Changes

### New Files
- `src/contexts/ControllerContext.tsx`
- `src/controller/mcpClient.ts`
- `src/controller/portalEventsClient.ts`
- `src/controller/types.ts`

### Modified Files
- `src/pages/controller/CtrlPaneDashboard.tsx`: Switch to live ControllerContext.
- `src/pages/controller/ServerInfo.tsx`: Switch to MCP tool call.
- `src/pages/controller/LoggerConfig.tsx`: Switch to MCP tool call.
- `src/pages/controller/LogViewer.tsx`: Switch to MCP tool call.
- `src/pages/controller/ChaosMonkey.tsx`: Switch to MCP tool call.

---

## 5. Security and Authentication

- **Handshake:** The WebSocket handshake will include the `Authorization` header with a valid JWT (managed by the `light-gateway` BFF).
- **Tenant Isolation:** The controller validates the `host` claim in the JWT against its configured `hostId`, ensuring the Portal only sees instances for its tenant.

---

## 6. Open Questions / For Final Review

1. **Health Check vs. Event Status:** Is a dedicated `check_service` health check tool still required, or should the "Status Check" column simply reflect the live connection status reported by the controller?
2. **Initial State Source:** Should the dashboard prioritize a full database fetch via REST on load, or is the MCP `list_services` snapshot sufficient?
3. **BFF Header Forwarding:** Confirm that the `light-gateway` is configured to forward the standard identity headers to the controller WebSocket upgrade.
