# RESTARNONDETACT-003: Restrain Target Action Definition

## Status

Completed.

## Scope & Assumptions (Updated)

- Grappling and restraint components already exist and are registered (`skills:grappling_skill`, `positioning:restraining`, `positioning:being_restrained`); no new components are required here.
- Rule/condition wiring and behavioral tests are covered in RESTARNONDETACT-004/005/006/007 and stay out of scope for this ticket.
- This ticket only delivers the action definition and its manifest entry, aligned with `specs/restrain-target-non-deterministic-action.md`.

## Requirements

- Add `data/mods/physical-control/actions/restrain_target.action.json` defining `physical-control:restrain_target` as a chance-based opposed action (ratio formula, bounds min 5 / max 95, critical thresholds 5 / 95).
- Target scope: `core:actors_in_location` with placeholder `target`, `generateCombinations: true`.
- Chance config: actorSkill `skills:grappling_skill.value` default 10; targetSkill `skills:defense_skill.value` default 0 with `targetRole: "primary"` (single-target action).
- Prerequisites: include `anatomy:actor-has-two-free-grabbing-appendages` with failure message “You need two free grabbing appendages to restrain someone.”
- Required components (actor): include `skills:grappling_skill` (no additional position requirements).
- Metadata: name “Restrain Target,” description “Attempt to physically restrain a target, preventing free movement.” Template `restrain {target} ({chance}% chance)`.
- Update `data/mods/physical-control/mod-manifest.json` to list the new action and declare the `skills` dependency needed for `skills:grappling_skill`, without altering other entries.

## Out of Scope

- Rules, conditions, macros, perception events, or component additions/changes.
- Test additions (covered by other tickets).

## Acceptance Criteria

- Action JSON matches the above chanceBased, targeting, prerequisites, template, and metadata requirements.
- Physical-control manifest registers the action and adds the `skills` dependency while leaving existing IDs, fields, and ordering of current entries unchanged.
- Commands: `npm run lint` and `npm run validate:quick` pass.

## Outcome

- Added `physical-control:restrain_target` action JSON with ratio-based opposed chance config, `targetRole: "primary"`, grappling vs defense defaults (10/0), prerequisite for two free grabbing appendages, and template `restrain {target} ({chance}% chance)`.
- Updated the physical-control manifest to register the action and declare the `skills` dependency required for the grappling skill reference, preserving existing entries.
- Ran `npm run validate:quick` successfully; `npm run lint` still fails on pre-existing repository issues outside the touched files.
