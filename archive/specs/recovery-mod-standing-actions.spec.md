# Recovery Mod: Standing Actions Migration Spec

## Overview
- Create a new `recovery` mod (`data/mods/recovery/`) focused on restoring fallen actors. It should house the existing self-stand action and a new assist action, both using the Recovery visual scheme.
- Dependencies: declare at least `core` and `positioning` (uses `positioning:fallen` and `positioning:being_restrained` components, plus existing core macros/events).

## Current State Findings
- Action: `data/mods/positioning/actions/push_yourself_to_your_feet.action.json` (id `positioning:push_yourself_to_your_feet`, template “push yourself to your feet”, visual uses `Deep Orange Energy`). Required `actor` component `positioning:fallen`; forbidden `actor` component `positioning:being_restrained`.
- Rule: `data/mods/positioning/rules/handle_push_yourself_to_your_feet.rule.json` + condition `data/mods/positioning/conditions/event-is-action-push-yourself-to-your-feet.condition.json` listen for `core:attempt_action`, remove `positioning:fallen`, regenerate description, unlock movement, and log success/failure.
- Tests: `tests/integration/mods/positioning/push_yourself_to_your_feet_action.test.js` covers discoverability, success path, perceptible event, wrong-action guard, witness handling.
- Component reference: `data/mods/positioning/components/fallen.component.json` defines the fallen state; leave in `positioning` and consume via dependency.

## Color Scheme Decision
- Use **Evergreen Shadow** (section 11.5) from `docs/mods/mod-color-schemes.md` for the `recovery` mod (now marked in use). Values:
  ```json
  {
    "backgroundColor": "#123524",
    "textColor": "#e8f5e9",
    "hoverBackgroundColor": "#1b5e20",
    "hoverTextColor": "#ffffff"
  }
  ```
- Apply this visual set to both the migrated self-stand action and the new help action.

## Deliverables
- New mod structure `data/mods/recovery/` with `mod-manifest.json` listing actions/conditions/rules and dependencies; update `data/mods/positioning/mod-manifest.json` to remove migrated entries.
- Migrated action/condition/rule:
  - Move `push_yourself_to_your_feet.action.json` → `data/mods/recovery/actions/` and re-id to `recovery:push_yourself_to_your_feet`; keep template/name, update visual to Evergreen Shadow.
  - Move `event-is-action-push-yourself-to-your-feet.condition.json` → `data/mods/recovery/conditions/` with id `recovery:event-is-action-push-yourself-to-your-feet`.
  - Move `handle_push_yourself_to_your_feet.rule.json` → `data/mods/recovery/rules/`, update references to new ids; preserve behavior (query actor fallen, remove component, regenerate description, unlock movement, success/failure logging).
- New action/rule combo “help {target} to their feet”:
  - Action id `recovery:help_target_to_their_feet`, template `help {target} to their feet`, description/name matching cooperative recovery.
  - Targets: primary scope `core:actors_in_location` (patterned after other targeted actions using that scope) with placeholder `target`.
  - Required components: primary target must have `positioning:fallen`.
  - Forbidden components: actor must not have `positioning:being_restrained` or `positioning:fallen`.
  - Visual: Evergreen Shadow scheme above.
  - Rule listens to `core:attempt_action` via new condition `recovery:event-is-action-help-target-to-their-feet`; on success remove `positioning:fallen` from target, regenerate target description if needed, dispatch success log/perceptible event with message `{actor} helps {target} to their feet.`, set perception type to a target-facing success (consistent with existing patterns), include actor locationId/targetId, then end turn. Handle non-fallen target gracefully with failure messaging if action is attempted improperly.
- Tests:
  - Relocate existing integration test to `tests/integration/mods/recovery/push_yourself_to_your_feet_action.test.js` and update ids/mod references; keep discoverability, witness perception, wrong-action guard, success removal assertions.
  - Add integration tests for the new assist action covering: availability only when a nearby target is fallen and actor passes forbidden checks; success path removes target `positioning:fallen`, regenerates description, and emits perceptible event/log with the specified message and correct location/target ids; ensures rule does not fire when targeting non-fallen actors or when actor is fallen/restrained.
  - Follow mod testing guidance in `docs/testing/` and existing mod tests in `tests/integration/mods/` for fixtures (`ModTestFixture.forAction`).

## Cleanup/Notes
- Ensure manifests and any archived references use the new ids; keep `positioning:fallen` component in `positioning` mod while declaring dependency from `recovery`.
- Maintain WCAG compliance by keeping visuals in sync with `docs/mods/mod-color-schemes.md` (already updated with Recovery usage).
