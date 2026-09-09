## Change

Describe the problem and resulting behavior.

## Validation

Describe the relevant checks and results.

## UI review

- [ ] New or changed row actions use `PortalActions` inside a shared `PortalActionScope`; both menu and expanded modes preserve visibility, permissions, loading, and navigation.
- [ ] Secondary action groups use the same renderer. Primary workflow controls and inline editing controls remain directly accessible.
- [ ] Action display is controlled only by the header setting and `portal.actionDisplay.v1`, with no page-specific or user-specific preference.
