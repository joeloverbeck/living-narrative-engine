# Distress "Bury Face in Hands" Action and Rule Specification

## Overview

This specification defines a self-comforting distress action where an actor buries their face in their hands to signal overwhelm and anguish. The design should mirror the schema structure and narrative sequencing used by the seduction mod's `stretch_sexily` action and rule while adapting the theming, copy, and behavior for the distress context.

## Goals

- Expand the distress mod with an action/rule pair that communicates a moment of emotional collapse through body language.
- Maintain visual and structural consistency with other distress gestures once the mod is populated.
- Ensure both the action and rule align with existing schema conventions validated by `stretch_sexily.action.json` and its rule counterpart.

## Functional Requirements

1. **Action Metadata**
   - **ID**: `distress:bury_face_in_hands`
   - **Name**: `Bury Face in Hands`
   - **Targets**: `"none"`
   - **Template**: `"bury your face in your hands"`
   - **Prerequisites**: _None_
   - **Description**: Highlight the actor collapsing inward, hiding their face, and shutting out the world.
2. **Visual Design**
   - Apply the distress palette documented as **Obsidian Frost** in `wcag-compliant-color-combinations.spec.md`:
     ```json
     {
       "backgroundColor": "#0b132b",
       "textColor": "#f2f4f8",
       "hoverBackgroundColor": "#1c2541",
       "hoverTextColor": "#e0e7ff"
     }
     ```
   - Use the same property ordering and casing seen in `stretch_sexily.action.json` for parity.
3. **Rule Behavior**
   - Triggered on `core:attempt_action` with a condition that checks for the new action ID (patterned after `seduction:event-is-action-stretch-sexily`).
   - Emit the following strings for both the perceptible event message and the success log message:
     > `{actor} buries their face in their hands.`
   - Resolve with `targetId` set to `null` to respect the `"none"` target configuration.
   - End the actor's turn using the same macro (`core:logSuccessAndEndTurn`) leveraged by the seduction rule.
4. **Schema Compliance**
   - Action, condition, and rule JSON files must validate against their respective schemas referenced in the existing seduction assets.

## Required Assets

1. **Action Definition**
   - **File**: `data/mods/distress/actions/bury_face_in_hands.action.json`
   - Clone the structure of `data/mods/seduction/actions/stretch_sexily.action.json`, updating identifiers, copy, template, and visual palette per this spec.
2. **Condition Definition**
   - **File**: `data/mods/distress/conditions/event-is-action-bury-face-in-hands.condition.json`
   - Implement an equality check on `event.payload.actionId` matching the new distress action ID.
3. **Rule Definition**
   - **File**: `data/mods/distress/rules/bury_face_in_hands.rule.json`
   - Mirror the sequencing used in `data/mods/seduction/rules/stretch_sexily.rule.json`, substituting the new copy, ensuring the perceptible event references the actor's location, and nullifying `targetId`.
4. **Manifest Update**
   - Register the new action, condition, and rule in `data/mods/distress/mod-manifest.json` so the ecosystem can load them.

## Testing Strategy

- **Integration – Action Discoverability**: Add a test (e.g., `tests/integration/mods/distress/bury_face_in_hands_action_discovery.test.js`) modeled after `tests/integration/mods/seduction/stretch_sexily_action_discovery.test.js` to confirm the action is discoverable without prerequisites and surfaces the specified template and visual styling.
- **Integration – Rule Behavior**: Add a rule-focused test (e.g., `tests/integration/mods/distress/rules/buryFaceInHandsRule.integration.test.js`) similar to `tests/integration/mods/seduction/rules/stretchSexilyRule.integration.test.js` to verify the perceptible event message, success log message, null target handling, and turn conclusion.

## Implementation Notes

- Follow property ordering and indentation conventions demonstrated in the seduction action and rule files to ease code review.
- Reuse helper macros and action scaffolding from the seduction implementation to reduce logic drift.
- Ensure both the perceptible and success log messages use the exact phrasing specified, including punctuation and casing.

## Acceptance Criteria

- Distress mod contains new action, condition, and rule assets wired through the manifest and matching all metadata requirements.
- Visual styling leverages the Obsidian Frost palette defined for the distress mod.
- Integration tests covering action discoverability and rule behavior exist and pass, validating messages, visual metadata, and turn resolution.
