# Kissing Mod Forehead Kiss Action & Rule Specification

## Overview

This specification defines a new gentle forehead kiss interaction for the kissing mod. The action will follow the same structural, visual, and behavioral patterns as the existing `kissing:kiss_cheek` combo while introducing distinct narrative flavor and messaging for the forehead variant.

## Design Goals

- **Affectionate Variation**: Provide a softer kissing option focused on the forehead.
- **Pattern Fidelity**: Reuse the architecture, visual scheme, and component structure established by `kissing:kiss_cheek`.
- **Discoverability**: Ensure the action appears for appropriately positioned actors who meet the closeness requirement and are not already kissing.
- **Narrative Consistency**: Emit matching perceptible and success messages describing the gentle forehead kiss.

## Functional Requirements

1. **Action Availability**
   - Targets scope: `kissing:close_actors_facing_each_other` (same scope used by `kissing:kiss_cheek`).
   - Required components: `actor` must have `positioning:closeness`.
   - Forbidden components: `actor` must **not** have `kissing:kissing`.
   - Action template: `"kiss {target}'s forehead gently"`.

2. **Action Execution Messaging**
   - Successful action result message: `"{actor} kisses {target}'s forehead gently."`.
   - Perceptible event message: `"{actor} kisses {target}'s forehead gently."`.
   - Perception type: `action_target_general`.
   - Both messages must share the exact text and punctuation.

3. **Visual Styling**
   - Mirror the color scheme used by `kissing:kiss_cheek`:
     ```json
     {
       "backgroundColor": "#ad1457",
       "textColor": "#ffffff",
       "hoverBackgroundColor": "#c2185b",
       "hoverTextColor": "#fce4ec"
     }
     ```

4. **Rule Behavior**
   - Trigger on `core:attempt_action` events using the dedicated condition that checks for the new action ID.
   - Fetch actor and target names via `GET_NAME` steps.
   - Capture actor position for location context just like the reference rule.
   - Set variables for `logMessage`, `perceptionType`, `locationId`, and `targetId` prior to invoking `core:logSuccessAndEndTurn`.
   - Ensure `logMessage` uses the new gentle forehead kiss phrasing.

5. **Schema Compliance**
   - All JSON definitions must validate against their respective schemas located under `schema://living-narrative-engine/`.

## Component Deliverables

### 1. Action Definition

**File:** `data/mods/kissing/actions/kiss_forehead_gently.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "kissing:kiss_forehead_gently",
  "name": "Kiss Forehead Gently",
  "description": "Lean in close and place a gentle kiss on the target's forehead.",
  "targets": "kissing:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["kissing:kissing"]
  },
  "template": "kiss {target}'s forehead gently",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#ad1457",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#c2185b",
    "hoverTextColor": "#fce4ec"
  }
}
```

### 2. Condition Definition

**File:** `data/mods/kissing/conditions/event-is-action-kiss-forehead-gently.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "kissing:event-is-action-kiss-forehead-gently",
  "description": "Checks if the triggering event is for the 'kissing:kiss_forehead_gently' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "kissing:kiss_forehead_gently"
    ]
  }
}
```

### 3. Rule Definition

**File:** `data/mods/kissing/rules/kiss_forehead_gently.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_kiss_forehead_gently",
  "comment": "Handles the 'kissing:kiss_forehead_gently' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "kissing:event-is-action-kiss-forehead-gently" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} kisses {context.targetName}'s forehead gently."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### 4. Mod Manifest Update

Add the new action, condition, and rule files to `data/mods/kissing/mod-manifest.json` so they are bundled with the mod's resources.

## Testing Strategy

Create comprehensive integration suites under `tests/integration/mods/kissing/` (see `tests/integration/mods/kissing/kiss_cheek_action.test.js` for reference patterns) that cover:

1. **Action Discoverability**
   - Use `ModTestFixture.forAction` to confirm the action becomes available to actors who are close, facing each other, and not already kissing.
   - Validate that actors missing the required closeness component or having the forbidden `kissing:kissing` component do not surface the action.

2. **Rule Behavior**
   - Execute the action and assert that:
     - `core:display_successful_action_result` emits `"{actor} kisses {target}'s forehead gently."`.
     - `core:perceptible_event` emits the same text with `perceptionType: 'action_target_general'`, correct `locationId`, `actorId`, and `targetId`.
     - Turn-ending behavior mirrors the reference action (a `core:turn_ended` event with `success: true`).
   - Include scenarios with multiple potential targets to ensure the rule consistently uses the selected target.

Ensure all new tests pass with `npm run test:integration` once implemented.

## Implementation Notes

- Follow the naming conventions used by `kissing:kiss_cheek` for consistency (`handle_*` rule IDs, `event-is-action-*` condition IDs).
- Maintain identical ordering of actions within the rule to simplify future diff reviews.
- Keep narrative tone gentle and affirming, matching the soft, affectionate intent of a forehead kiss.
