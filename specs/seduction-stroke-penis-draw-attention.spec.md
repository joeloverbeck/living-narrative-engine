# Seduction "Stroke Penis to Draw Attention" Action and Rule Specification

## Overview

This specification introduces a new self-focused seduction action where the acting actor strokes their own bare penis to entice observers. The feature should align with the seduction mod's established patterns for self-directed attention-drawing moves, using `draw_attention_to_breasts.action.json` as the structural and visual reference point while borrowing prerequisite logic from penetration-focused actions such as `sex-vaginal-penetration:insert_penis_into_vagina`.

## Goals

- Expand the seduction mod with a masturbation-adjacent action that showcases the actor's penis seductively.
- Maintain consistency with existing seduction UX, schema structure, and color palette conventions.
- Deliver rule messaging that emphasizes the seductive display and ends the attempt cleanly when successful.

## Functional Requirements

1. **Action Metadata**
   - **ID**: `seduction:stroke_penis_to_draw_attention`
   - **Name**: `Stroke Penis to Draw Attention`
   - **Description**: Highlight the actor stroking their bare penis in an alluring manner to command focus.
   - **Targets**: `"none"`
   - **Template**: `"stroke your penis to draw attention"`
2. **Component Constraints**
   - **Forbidden Components**: `actor` must forbid `positioning:hugging`, mirroring how `draw_attention_to_breasts` blocks restrictive stances.
   - **Required Components**: None beyond prerequisites.
3. **Prerequisites**
   - Actor must have a penis (`hasPartOfType` check identical to the penetration initiation action).
   - Actor's penis must be uncovered (`not` `isSocketCovered` on the penis), replicating the uncovered requirement from `insert_penis_into_vagina.action.json`.
4. **Visual Design**
   - Match the exact color configuration used by `draw_attention_to_breasts.action.json`: background `#f57f17`, text `#000000`, hover background `#f9a825`, hover text `#212121`.
5. **Rule Messaging**
   - Perceptible event and success messages must both read: `{actor} strokes their bare penis seductively, drawing attention to it.`
   - Ensure the rule uses the seduction mod's self-targeting conventions (no `targetId`).

## Required Assets

1. **Action Definition**
   - **File**: `data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json`
   - Clone the structure from `draw_attention_to_breasts.action.json`, adjusting ID, name, description, template, prerequisites, forbidden components, and maintaining `targets: "none"` and the visual block.
2. **Condition Definition**
   - **File**: `data/mods/seduction/conditions/event-is-action-stroke-penis-to-draw-attention.condition.json`
   - Equality check on `event.payload.actionId` for `seduction:stroke_penis_to_draw_attention`, following the seduction condition pattern.
3. **Rule Definition**
   - **File**: `data/mods/seduction/rules/stroke_penis_to_draw_attention.rule.json`
   - Follow the sequencing from `draw_attention_to_breasts.rule.json`, updating references to the new action, reusing helper macros, emitting the specified perceptible and success messages, and ending the turn appropriately.
4. **Manifest Update**
   - Add entries for the new action, condition, and rule to `data/mods/seduction/mod-manifest.json` alongside the other seduction assets.

## Testing Strategy

- **Integration – Action Discoverability**: Create a comprehensive suite (e.g., `tests/integration/mods/seduction/stroke_penis_to_draw_attention_action_discovery.test.js`) modeled after the seduction discovery tests. Verify prerequisites enforce penis ownership and uncovered status, ensure the forbidden `positioning:hugging` component suppresses availability, and confirm the template and visual styling match expectations.
- **Integration – Rule Behavior**: Author a rule-focused suite (e.g., `tests/integration/mods/seduction/rules/stroke_penis_to_draw_attention_rule.test.js`) to assert that attempting the action emits the exact perceptible and success messages, respects the self-targeting configuration, and resolves rule side effects without leaking unrelated events.

## Implementation Notes

- Use the ordering of keys from `draw_attention_to_breasts.action.json` to keep seduction actions consistent.
- Reuse prerequisite message phrasing patterns from existing mods (e.g., "You need a penis to perform this action" / "Your penis must be uncovered to perform this action") unless seduction copy guidelines require a different tone.
- Confirm that schema references (`action`, `condition`, `rule`) stay intact and validate with `npm run scope:lint` if needed.
- Ensure the rule's perceptible event uses the seduction storytelling voice and integrates with any existing logging helpers.

## Acceptance Criteria

- New action, condition, and rule files exist with schema-compliant definitions, proper IDs, prerequisites, forbidden components, and matching visual styling.
- Seduction mod manifest includes the assets so the action is discoverable in-game.
- Integration tests for discoverability and rule behavior fully cover positive and negative cases, passing under the existing mod test harness documented in `docs/testing/`.
- Messaging for the new rule matches the required sentence exactly and appears in both the perceptible event and success log outputs.
