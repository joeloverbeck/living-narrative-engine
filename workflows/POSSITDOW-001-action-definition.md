# POSSITDOW-001: Define `positioning:sit_down_at_distance` Action

**Phase:** 1 - Feature Foundations
**Priority:** High
**Estimated Effort:** 4 hours

## Goal

Create the multi-target action definition that allows actors to sit on furniture while intentionally leaving a one-seat buffer from a selected occupant.

## Context

The new behavior must coexist with the legacy `positioning:sit_down` action. This ticket captures the schema work required in `data/mods/positioning/actions` to expose the new targeting template and ensure standard posture restrictions remain intact.

## Tasks

### 1. Add Action File
- Create `data/mods/positioning/actions/sit_down_at_distance.action.json` (exact filename may follow repository naming conventions).
- Base structure on `sit_down.action.json` while updating `id`, `name`, and `description` to communicate the intentional distance.
- Confirm the actor `requiresComponents` and `forbiddenComponents` mirror the legacy sit-down action to avoid posture conflicts.

### 2. Configure Multi-Target Schema
- Define `targets.primary` to reuse `positioning:available_furniture` so the action only appears on furniture with open seats in the actor's location.
- Define `targets.secondary` to reference the forthcoming scope (see POSSITDOW-002) using `contextFrom: "primary"` so the scope resolves against the selected furniture instance.
- Ensure the action template reads `"sit down on {primary} at a distance from {secondary}"` and the `label`/`hint` metadata surfaces both targets.

### 3. Validate Schema Compliance
- Run `npm run scope:lint` and any relevant JSON schema validation scripts to confirm the new file passes existing tooling.
- Adjust metadata fields (e.g., `tags`, `icon`, `visibleWhen`) if lint feedback indicates required defaults.

### 4. Document Action Metadata Decisions
- Inline comment (if the repository pattern allows) or add notes to the PR describing why actor requirements were duplicated instead of referenced.
- Capture open questions about localization (see specification) so follow-up tickets can resolve them if additional strings are needed.

## Acceptance Criteria
- Action file exists with correctly wired multi-target structure and descriptive template string.
- Linting/validation pipelines report no schema errors.
- Action surfaces only when both primary furniture and a qualifying secondary occupant are available.
