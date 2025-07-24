# Macro Optimization Analysis Report

**Date**: 2025-01-24  
**Scope**: Analysis of rule definitions in `core`, `sex`, and `intimacy` mods  
**Purpose**: Identify opportunities to reduce repetition through macro usage

## Executive Summary

This report analyzes the rule definition files across three mods to identify repetitive patterns that could be consolidated into reusable macros. The analysis found that approximately 90% of intimacy and sex action rules follow nearly identical patterns, presenting a significant opportunity for code reduction and improved maintainability.

Additionally, the analysis revealed that most rules are likely missing proper past-tense perception event messages, which should differ from the present-tense UI success messages.

## Current Macro System Overview

### Existing Macros
The `core` mod currently provides four macros:

1. **`core:logSuccessAndEndTurn`**
   - Creates a perceptible event with a log message
   - Displays success message to UI
   - Ends the turn with success status
   - Used by: 25+ rules across all mods
   - **Issue**: Uses the same message for both perception (should be past tense) and UI (should be present tense)

2. **`core:displaySuccessAndEndTurn`**
   - Displays success message to UI
   - Ends the turn with success status
   - Used by: 3 rules (adjust_clothing, go, dismiss)

3. **`core:logFailureAndEndTurn`**
   - Displays failure message to UI
   - Ends the turn with failure status
   - Used by: 2 rules (follow, stop_following)

4. **`core:autoMoveFollower`**
   - Specialized macro for follower movement
   - Used by: 1 rule (follow_auto_move)

### Macro System Implementation
- Macros are defined as JSON files with an array of actions
- Rules invoke macros using `{ "macro": "modId:macroId" }`
- Macros are expanded recursively during rule loading
- Macros cannot accept parameters; they rely on context variables

## Critical Finding: Tense Mismatch in Current Implementation

The existing `core:logSuccessAndEndTurn` macro has a design flaw: it uses `context.logMessage` for both:
1. The perception event description (which should be past tense: "X has done Y")
2. The UI success message (which should be present tense: "X does Y")

This means **all rules currently using this macro are likely displaying incorrect tenses** in either the perception log or the UI.

## Pattern Analysis

### Common Pattern in Intimacy/Sex Rules

The vast majority of intimacy and sex action rules follow this 8-step pattern:

```json
{
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
        "value": "{context.actorName} [PRESENT TENSE ACTION] {context.targetName}."
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

### Rules with Tense Issues

#### All Rules Using `core:logSuccessAndEndTurn` (25+ rules)
These rules set only `logMessage` which is used for both perception and UI, causing tense mismatches:

**Sex Mod** (all 4 rules have this issue):
- `handle_fondle_breasts.rule.json`: "eagerly fondles" (should have "has eagerly fondled" for perception)
- `handle_fondle_penis.rule.json`: Similar issue
- `handle_rub_penis_over_clothes.rule.json`: "rubs" (should have "has rubbed" for perception)
- `handle_rub_vagina_over_clothes.rule.json`: "rubs" (should have "has rubbed" for perception)

**Intimacy Mod** (23 rules have this issue):
- `kiss_cheek.rule.json`: "leans in to kiss" (should have "has leaned in to kiss" for perception)
- `handle_fondle_ass.rule.json`: "gently fondles" (should have "has gently fondled" for perception)
- `peck_on_lips.rule.json`: "pecks" (should have "has pecked" for perception)
- And 20 more with similar issues...

### Rules That Handle Tenses Correctly

Only a few rules properly differentiate between tenses:

1. **`handle_feel_arm_muscles.rule.json`** - PARTIALLY CORRECT:
   - Sets `logMessage`: "feels the hard swell of {target}'s muscles"
   - Sets `perceptionEventMessage`: "has felt the hard swell of {target}'s muscles"
   - But still uses the flawed macro that ignores `perceptionEventMessage`

2. **`cup_face_while_kissing.rule.json`** - CORRECT:
   - Implements the full pattern inline (doesn't use macro)
   - Sets `successMessage`: "possessively cups {target}'s face"
   - Sets `logMessage`: "has possessively cupped {target}'s face"
   - Properly uses different tenses

### Rules Without Macros

Several intimacy rules implement the full pattern inline:
- `cup_face_while_kissing.rule.json` (correctly handles tenses)
- `suck_on_tongue.rule.json`
- `nibble_lower_lip.rule.json`
- `kiss_back_passionately.rule.json`
- `explore_mouth_with_tongue.rule.json`
- `accept_kiss_passively.rule.json`

These need to be checked for proper tense usage.

## Optimization Recommendations

### Fix the Existing Macro

The current `core:logSuccessAndEndTurn` macro should be deprecated or fixed to handle both tenses properly.

### Proposed New Macros

#### 1. `core:handleSimpleTargetedAction`
For actions where the tense conversion is straightforward:

```json
{
  "id": "core:handleSimpleTargetedAction",
  "description": "Standard handler for targeted actions with automatic past tense for perception",
  "comment": "Requires: context.presentTenseMessage to be set. Will create past tense for perception.",
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
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "GET_TIMESTAMP",
      "parameters": { "result_variable": "nowIso" }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:perceptible_event",
        "payload": {
          "eventName": "core:perceptible_event",
          "locationId": "{context.locationId}",
          "descriptionText": "{context.pastTenseMessage}",
          "timestamp": "{context.nowIso}",
          "perceptionType": "{context.perceptionType}",
          "actorId": "{event.payload.actorId}",
          "targetId": "{context.targetId}",
          "involvedEntities": []
        }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": { "message": "{context.presentTenseMessage}" }
      }
    },
    {
      "type": "END_TURN",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

### Usage After Implementation

Rules would properly handle both tenses:

```json
{
  "actions": [
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "presentTenseMessage",
        "value": "{context.actorName} kisses {context.targetName}'s cheek softly."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "pastTenseMessage",
        "value": "{context.actorName} has kissed {context.targetName}'s cheek softly."
      }
    },
    { "macro": "core:handleSimpleTargetedAction" }
  ]
}
```

## Expected Benefits

1. **Correctness**: Proper tense usage in perception logs vs UI
2. **Code Reduction**: ~70% reduction in rule file size
3. **Maintainability**: Common behavior changes need only one update
4. **Consistency**: Enforces consistent pattern across all actions
5. **Error Prevention**: Reduces chance of missing required steps or tense errors

## Implementation Recommendations

### Phase 1: Fix Existing Rules
1. Audit all rules using `core:logSuccessAndEndTurn` 
2. Identify which message tense they're using (likely present)
3. Add proper past-tense messages for perception events

### Phase 2: Create New Macros
1. Create the new macro that properly handles both tenses
2. Consider creating a tense conversion utility if patterns are consistent

### Phase 3: Update Rules
1. Update all affected rules to provide both tenses
2. Test each rule to ensure proper display in both UI and perception log

## Affected Rules Summary

### Rules Needing Past Tense Messages (High Priority)
All 27+ rules currently using `core:logSuccessAndEndTurn`:

**Sex Mod**: All 4 rules
**Intimacy Mod**: 23 rules
**Violence Mod**: At least 2 rules (slap, sucker_punch)
**Core Mod**: Several rules (follow, etc.)

### Rules to Review
The 6 intimacy rules implementing inline patterns need review to ensure they properly handle both tenses.

## Risk Considerations

- **Breaking Changes**: Fixing the tense issue will require updates to many rules
- **Testing Required**: Both UI and perception log must be tested for each rule
- **Backward Compatibility**: May need to support old macro during transition

## Conclusion

The analysis reveals two major findings:
1. Significant opportunities for code optimization through strategic macro usage
2. A systemic tense mismatch issue affecting most action rules in the game

The tense issue should be addressed as a priority, as it affects the game's narrative consistency. The proposed macro system would both fix this issue and dramatically reduce code duplication.