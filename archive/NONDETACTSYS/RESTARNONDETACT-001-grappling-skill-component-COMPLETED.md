# RESTARNONDETACT-001: Grappling Skill Component

## Description
Add a new `skills:grappling_skill` component mirroring `skills:defense_skill` to represent grappling competency, and register it in the skills mod manifest. Default value should be 0 with integer bounds 0–100 and descriptive metadata noting its use for physical grapples/restrains.

## Current Findings
- No grappling skill component exists today; the skills manifest only lists `defense_skill`, `melee_skill`, and `ranged_skill` components.
- Existing skill components follow `component.schema.json` with integer `value` min 0, max 100, default 0—`defense_skill` is the template to mirror.
- There are no skills-specific tests covering component presence; schema validation via `npm run validate:quick` is the relevant check.

## Expected File List
- `data/mods/skills/components/grappling_skill.component.json` (Add)
- `data/mods/skills/mod-manifest.json` (Modify)

## Out of Scope
- Any changes to existing skill components (e.g., `defense_skill`, `melee_skill`).
- Action or rule wiring; no changes under `data/mods/physical-control/` or `data/mods/positioning/`.
- Test additions; this ticket only adds the component and manifest entry.

## Acceptance Criteria
- Component shape matches defense_skill: integer `value`, default 0, min 0, max 100; description references grappling/restraint contexts.
- Skills manifest lists `grappling_skill.component.json` alongside existing components without removing or reordering other entries.
- Commands: `npm run lint` and `npm run validate:quick` pass.

### Invariants
- Existing skill defaults and behaviors remain unchanged.
- No new actions/rules/conditions are added; manifests outside `data/mods/skills/` remain untouched.

## Status
Completed.

## Outcome
- Added `skills:grappling_skill` component mirroring `defense_skill` with integer value bounds 0–100 and default 0 for grappling/restraint contexts.
- Appended `grappling_skill.component.json` to the skills mod manifest without altering existing entries.
- Validated mods via `npm run validate:quick`; full repo lint currently fails on pre-existing issues unrelated to this change.
