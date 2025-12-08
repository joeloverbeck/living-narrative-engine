# FIRAIDDISWOUBODPAR-005: Rule and condition for disinfect action handling

## Status
Completed.

## Goal
Wire `first-aid:disinfect_wounded_part` through a condition and rule that applies `first-aid:disinfected`, emits messaging, regenerates descriptions, and advances time.

## Current state check
- Action `first-aid:disinfect_wounded_part` already exists with scopes wired, discovery coverage lives in `tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js`.
- Disinfectant scope lives in the items mod as `items:disinfectant_liquids_in_inventory` and is already in that manifest.
- `first-aid:disinfected` component schema only accepts `{ appliedById, sourceItemId }` (no turn metadata fields available); tests enforce this shape.
- First-aid mod manifest currently has no rules or conditions registered for this action.

## Adjusted scope
- Add `data/mods/first-aid/conditions/event-is-action-disinfect-wounded-part.condition.json` gating on `event.payload.actionId === "first-aid:disinfect_wounded_part"`.
- Add `data/mods/first-aid/rules/handle_disinfect_wounded_part.rule.json` listening on `core:attempt_action` that:
  - Resolves names for actor, target (primary), wounded body part (secondary), and disinfectant item (tertiary).
  - Applies `first-aid:disinfected` to the wounded body part with `{ appliedById: actorId, sourceItemId: disinfectantId }` and leaves other components untouched.
  - Regenerates descriptions for the treated actor/body part so status reflects immediately.
  - Logs the message `{actor} disinfects {target}'s {woundedBodyPart} with {disinfectant}.`, dispatches a perceptible event, and ends the turn via the standard macro cadence.
- Update the first-aid manifest to include the new condition and rule entries.

## Outcome
- Added the new condition and rule files wired through the first-aid manifest.
- Rule applies the existing `first-aid:disinfected` shape (applier + source item) to the selected body part, regenerates descriptions for the patient and part, emits the disinfect message, and ends the turn via `core:logSuccessAndEndTurn`.
- Integration test under `tests/integration/mods/first-aid/` covers action gating, messaging/perception context, component application, and regeneration references.

## Acceptance criteria
- Integration test under `tests/integration/mods/first-aid/` verifies:
  - Condition fires only for `first-aid:disinfect_wounded_part` attempts.
  - Rule sets up `logSuccessAndEndTurn` context (locationId, perceptionType, targetId, logMessage) and emits the perceptible message above.
  - The targeted body part gains `first-aid:disinfected` with `appliedById` = actorId and `sourceItemId` = disinfectantId; no other entities gain that component.
  - Description regeneration is requested for the treated actor/body part and the turn ends successfully.
