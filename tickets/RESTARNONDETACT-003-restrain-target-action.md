# RESTARNONDETACT-003: Restrain Target Action Definition

## Description
Create `physical-control:restrain_target` chance-based opposed action definition with grappling vs defense ratio contest (min 5, max 95), single target in actor location, prerequisite `anatomy:actor-has-two-free-grabbing-appendages`, and `required_components.actor` including `skills:grappling_skill` (and `core:position` if consistent with other phys-control actions). Provide template like `restrain {target} ({chance}% chance)` and descriptive metadata per spec.

## Expected File List
- `data/mods/physical-control/actions/restrain_target.action.json` (Add)
- `data/mods/physical-control/mod-manifest.json` (Modify: register new action)

## Out of Scope
- Rule/condition handling, macros, or perception events (handled in separate ticket).
- Positioning component or skill component definitions (covered by other tickets).
- Test additions.

## Acceptance Criteria
- Action JSON marks `chanceBased` with `contestType: "opposed"`, `formula: "ratio"`, `minChance: 5`, `maxChance: 95`, `criticalSuccessThreshold: 5`, `criticalFailureThreshold: 95` (matching swing_at_target). Defaults: actor grappling value 10, target defense value 0 when components missing; `targetRole` set for target skill.
- Targets scope `core:actors_in_location` with placeholder `target`, `generateCombinations: true`, and prerequisite includes failure message “You need two free grabbing appendages to restrain someone.”
- Action manifests the name “Restrain Target” and description “Attempt to physically restrain a target, preventing free movement.”
- Physical-control manifest lists the new action without altering existing entries.
- Commands: `npm run lint` and `npm run validate:quick` pass.

### Invariants
- Existing physical-control actions remain unchanged (IDs, fields, ordering).
- No rule/condition references are added beyond manifest registration of the action.
