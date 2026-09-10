# Shared action display

The header profile menu provides a checkable **Expanded buttons** item under
Action display. Arrow keys reach it; Enter or Space toggles the preference. The
browser-origin preference is `portal.actionDisplay.v1`, with `menu` (default)
or `expanded`. It survives account changes and synchronizes between tabs.

## Adding actions

Wrap each table in `PortalActionScope`, then render `PortalActions` from its
`renderRowActions` callback. Supply one ordered list of action definitions for
both modes. Definitions keep business checks and handlers on the owning page.
Use `hidden` for inapplicable actions, `disabledReason` for temporarily
unavailable actions, and `loading` to prevent duplicate invocation. Give
non-obvious actions a description and mark destructive actions explicitly.

`usePortalActionTableOptions` keeps menus at 120px. In expanded mode, the scope
measures the visible icon groups and cell padding, then aligns every action cell
to the widest row. Resize observation keeps widths current when rows, visibility,
or density change; removing a wider row lets the column shrink. Native table
layout reserves only the content width, while resizable MRT grids use the same
measured pixel width. No page maintains a separate action count.

Expanded mode shows one compact row of icon-only buttons with hover descriptions.
Table position, filters, pagination, and selection remain unchanged. Native MUI tables use
`PortalActionTableCell` inside a scope around the table. Card actions can use the renderer; a catalog list owns one scope around all
its cards. Page-level and toolbar buttons remain labeled buttons outside the
shared renderer, independent of the display preference. Never wrap each row in
a separate scope within a table.

The scope owns one menu. It reads current action definitions while open and
closes before invoking a selected action, so dialog focus is not stolen by the
menu's focus restoration. Unmounting the source cancels pending selection.

## Migration coverage

- Every production `renderRowActions` callback, including ConfigUpdatePage's
  inline table options, uses the shared renderer.
- Legacy update/delete/config action columns are combined into one Actions
  column on configuration, instance association, product environment/pipeline,
  and schedule tables.
- Native tables: BlogAdmin, AgentAssignment, SkillWorkspace, LLM ResourcePanel,
  LLM publication history, A2A authoring and A2A publication history.
- Cards: API/schema/workflow catalogs and Knowledge Base policy/profile cards.
- Page-level and toolbar buttons are excluded, including configuration editing/sync,
  policy overview, snapshot history, promotion refresh, publication profiles,
  profile/entity maintenance, catalog administration, module reload-all,
  clone-result links, snapshot copy/download, and skill editing.

Primary Create/Add, Save/Cancel, Compare and other selection-driven operations
remain visible. Table search, refresh, pagination, expand/collapse, field-copy
controls, and editor controls also remain direct. Guided workflows keep their
primary editing, testing, approval, execution, and stream controls; they are not
row-action collections. The header preference does not alter those controls.

The PR checklist guards adoption on future pages. Review new action callbacks
and custom tables for the shared pattern rather than adding independent menus.

Page-level buttons preserve disabled-state explanations in tooltips, using a
span wrapper so disabled buttons can expose the reason. Delete buttons use
error styling to distinguish destructive actions from adjacent Edit or Update
buttons. These affordances apply in both action-display modes.
