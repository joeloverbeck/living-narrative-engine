# POSSITDOW-001: Define `positioning:sit_down_at_distance` Action

**Phase:** 1 - Feature Foundations
**Priority:** High
**Estimated Effort:** 4 hours

## Goal

Create the multi-target action definition that allows actors to sit on furniture while intentionally leaving a one-seat buffer from a selected occupant.

## Context

The new behavior must coexist with the legacy `positioning:sit_down` action. Action definitions in this mod use the JSON schema located at `schema://living-narrative-engine/action.schema.json`. Keys follow the repository's snake_case conventions (`required_components`, `forbidden_components`, etc.), and multi-target actions express `targets` as an object whose entries include `scope`, `placeholder`, optional `contextFrom`, and human-readable `description` strings. This ticket captures the schema work required in `data/mods/positioning/actions`—and the corresponding manifest update—to expose the new targeting template while preserving the existing posture restrictions.

## Tasks

### 1. Add Action File
- Create `data/mods/positioning/actions/sit_down_at_distance.action.json` (matching the existing `snake_case` naming convention).
- Base the JSON structure on `sit_down.action.json`, updating the `id`, `name`, and `description` to reflect the intentional distance requirement.
- Copy the actor restrictions using the repository's key names (`required_components.actor` and `forbidden_components.actor`) so posture conflicts stay aligned with the legacy action.
- Add the new action filename to `content.actions` in `data/mods/positioning/mod-manifest.json`; the engine only loads actions that are declared in the manifest.

### 2. Configure Multi-Target Schema
- Replace the legacy single-string `targets` field with a `targets` object:
  - `primary`: reuse `positioning:available_furniture`, include a descriptive `placeholder` (e.g., `"seat"`) and human-readable `description` text.
  - `secondary`: reference the forthcoming scope from POSSITDOW-002, include an appropriate `placeholder` (e.g., `"occupant"`), set `contextFrom: "primary"`, and provide a descriptive string so authors understand the selection.
- Update the `template` to interpolate the placeholder names the schema exposes (e.g., `"sit down on {seat} at a distance from {occupant}"`). `label`/`hint` metadata is not part of this schema; ensure clarity through the placeholders and description fields instead.

### 3. Validate Schema Compliance
- Run `npm run scope:lint` and any relevant JSON schema validation scripts to confirm the new file passes existing tooling.
- Keep the existing visual styling block consistent with the positioning mod unless there is a documented reason to change it; the schema does not require additional metadata fields such as `tags` or `icon`.

### 4. Document Action Metadata Decisions
- JSON action files do not support inline comments; capture the reasoning for duplicating actor requirements (instead of referencing shared macros) in the PR description or supporting documentation.
- Note any open localization questions in the PR so that follow-up tickets can provide additional strings if needed.

## Acceptance Criteria
- Action file exists with correctly wired multi-target structure and descriptive template string.
- Linting/validation pipelines report no schema errors.
- Action surfaces only when both primary furniture and a qualifying secondary occupant are available.
