# Seduction "Stretch Sexily" Action and Rule Specification

## Overview

This specification defines a new self-focused seduction action where an actor performs a sensual stretch to capture attention. The action should mirror the structural conventions already established by the seduction mod's existing actions while introducing new flavor text that highlights languid, space-claiming body language.

## Goals

- Expand the seduction mod with an additional self-targeting action that fits the existing aesthetic and UX patterns.
- Provide flavorful narrative output describing an actor stretching seductively.
- Maintain schema compliance and visual consistency across seduction actions and rules.

## Functional Requirements

1. **Action Metadata**
   - **ID**: `seduction:stretch_sexily`
   - **Name**: `Stretch Sexily`
   - **Targets**: `"none"`
   - **Template**: `"stretch sexily"`
   - **Prerequisites**: _None_
   - **Description**: Emphasize the actor stretching languidly to draw attention.
2. **Visual Design**
   - Reuse the orange color palette found in `draw_attention_to_breasts.action.json` and `draw_attention_to_ass.action.json` (background `#f57f17`, hover `#f9a825`, text `#000000`, hover text `#212121`).
3. **Rule Behavior**
   - Triggered by `core:attempt_action` with condition referencing the new action ID.
   - Produce both the perceptible event message and the success log message:
     > `{actor} tilts head and spine, claiming space with a languid stretch, drawing attention to their body.`
   - Ensure `targetId` is `null` to match the `"none"` target configuration.
4. **Schema Compliance**
   - All JSON definitions must validate against their respective schemas (`action`, `condition`, `rule`).

## Required Assets

1. **Action Definition**
   - **File**: `data/mods/seduction/actions/stretch_sexily.action.json`
   - Clone the structural layout of `draw_attention_to_breasts.action.json`, adjusting ID, name, template, description, and removing prerequisites.
2. **Condition Definition**
   - **File**: `data/mods/seduction/conditions/event-is-action-stretch-sexily.condition.json`
   - Simple equality check on `event.payload.actionId` for `seduction:stretch_sexily`.
3. **Rule Definition**
   - **File**: `data/mods/seduction/rules/stretch_sexily.rule.json`
   - Follow the sequencing of `draw_attention_to_ass.rule.json`, updating the narrative text to the specification above and ensuring the self-targeting structure remains intact.
4. **Manifest Update**
   - Add references for the new action, condition, and rule to `data/mods/seduction/mod-manifest.json`.

## Testing Strategy

- **Integration – Action Discoverability**: Create a test (e.g., `tests/integration/mods/seduction/stretch_sexily_action_discovery.test.js`) modeled after `draw_attention_to_ass_action_discovery.test.js` to verify the action appears with no prerequisites and advertises the expected template and visual styling.
- **Integration – Rule Behavior**: Create a rule-focused test (e.g., `tests/integration/mods/seduction/rules/stretch_sexily_rule.test.js`) to ensure the new rule emits the specified perceptible event and success messages and ends the actor's turn correctly.

## Implementation Notes

- Reference existing seduction action files for formatting and property ordering to maintain consistency.
- Because there are no prerequisites, ensure the `prerequisites` array is either omitted or provided as an empty array, depending on schema expectations (match whichever pattern seduction actions use when prerequisites are absent).
- Reuse existing helper macros such as `core:logSuccessAndEndTurn` to maintain consistent rule side effects.
- Confirm that both log and perceptible messages use the exact phrasing defined in this spec, including punctuation.

## Acceptance Criteria

- New action and rule files exist with correct IDs, template, messaging, and visual styling.
- Seduction manifest references the new resources so they are loadable in the mod ecosystem.
- Integration tests for action discoverability and rule behavior exist and pass, covering discovery, messaging, and turn resolution for the new action.
