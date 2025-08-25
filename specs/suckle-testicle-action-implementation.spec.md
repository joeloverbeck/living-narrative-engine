# Suckle Testicle Action/Rule Implementation Specification

## Executive Summary

This specification defines the implementation of a new action/rule combination for the 'sex' mod in Living Narrative Engine. The new action allows characters to "suckle on testicle" with appropriate positioning requirements and sensual messaging. This implementation closely follows the existing `lick_testicles_sensually` action as a reference pattern.

## Table of Contents

1. [Requirements Overview](#requirements-overview)
2. [Action Definition](#action-definition)
3. [Rule Definition](#rule-definition)
4. [Supporting Files](#supporting-files)
5. [Testing Requirements](#testing-requirements)
6. [Implementation Details](#implementation-details)
7. [Quality Assurance](#quality-assurance)

## Requirements Overview

### Primary Requirements

- **New Action**: `suckle_testicle` that allows suckling on target's testicle
- **Template**: `"suckle on {target}'s testicle"`
- **Positioning**: Requires closeness and kneeling_before components
- **Scope**: Reuse existing `sex:actor_kneeling_before_target_with_testicle`
- **Visual Theme**: Identical purple color scheme as reference action
- **Rule Message**: `"{actor} suckles on {target}'s testicle, tracing the hard oval inside with the tongue."`

### Reference Implementation

Based on the existing `sex:lick_testicles_sensually` action located at:

- Action: `data/mods/sex/actions/lick_testicles_sensually.action.json`
- Rule: `data/mods/sex/rules/handle_lick_testicles_sensually.rule.json`
- Condition: `data/mods/sex/conditions/event-is-action-lick-testicles-sensually.condition.json`
- Scope: `data/mods/sex/scopes/actor_kneeling_before_target_with_testicle.scope`

## Action Definition

### File Location

`data/mods/sex/actions/suckle_testicle.action.json`

### Action Structure

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex:suckle_testicle",
  "name": "Suckle Testicle",
  "description": "Sensually suckle on the target's testicle while kneeling before them from up close.",
  "targets": {
    "primary": {
      "scope": "sex:actor_kneeling_before_target_with_testicle",
      "placeholder": "target",
      "description": "Person with testicles to suckle"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:kneeling_before"]
  },
  "template": "suckle on {target}'s testicle",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#4a148c",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#6a1b9a",
    "hoverTextColor": "#f3e5f5"
  }
}
```

### Key Properties

- **ID**: `sex:suckle_testicle` - Following mod:action naming convention
- **Name**: "Suckle Testicle" - Human-readable display name
- **Template**: `"suckle on {target}'s testicle"` - Player command format (follows pattern of reference action)
- **Scope**: Reuses existing testicle scope for consistency
- **Components**: Requires both closeness and kneeling_before for positioning
- **Visual**: Identical purple theme as reference (`#4a148c` background, `#e1bee7` text)

## Rule Definition

### File Location

`data/mods/sex/rules/handle_suckle_testicle.rule.json`

### Rule Structure

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_suckle_testicle",
  "comment": "Handles the 'sex:suckle_testicle' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex:event-is-action-suckle-testicle"
  },
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
        "value": "{context.actorName} suckles on {context.targetName}'s testicle, tracing the hard oval inside with the tongue."
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

### Key Properties

- **Rule ID**: `handle_suckle_testicle` - Follows handle\_{action} naming convention
- **Condition**: References new condition for event matching
- **Actions**: Identical pattern to reference - GET_NAME operations, QUERY_COMPONENT for position, SET_VARIABLE operations, macro call
- **Message**: `"{context.actorName} suckles on {context.targetName}'s testicle, tracing the hard oval inside with the tongue."`

## Supporting Files

### Condition Definition

#### File Location

`data/mods/sex/conditions/event-is-action-suckle-testicle.condition.json`

**Note**: The condition file naming pattern follows the existing codebase convention: `event-is-action-{action-name-with-hyphens}.condition.json`

#### Condition Structure

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex:event-is-action-suckle-testicle",
  "description": "Checks if the triggering event is for the 'sex:suckle_testicle' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "sex:suckle_testicle"]
  }
}
```

### Scope Reuse

The implementation will reuse the existing scope:

- **File**: `data/mods/sex/scopes/actor_kneeling_before_target_with_testicle.scope`
- **Scope ID**: `sex:actor_kneeling_before_target_with_testicle`
- **Logic**: Filters for actors in closeness where actor is kneeling before target with exposed testicles

No new scope file is required as the positioning and anatomical requirements are identical to the reference action.

## Testing Requirements

### Comprehensive Test Coverage

The implementation must include comprehensive test suites covering both action discoverability and rule behavior, following the patterns established in the existing codebase.

### 1. Action Discovery and Integration Tests

#### File Location

`tests/integration/mods/sex/suckle_testicle_action.test.js`

**Note**: Based on the existing codebase patterns, this single integration test file should cover rule execution, event dispatching, and action functionality. Action discovery testing is handled implicitly through proper entity setup in the test environment.

#### Test Requirements

```javascript
/**
 * @file Integration tests for the sex:suckle_testicle action and rule.
 * @description Tests the rule execution after the suckle_testicle action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

// Required Test Cases:
describe('sex:suckle_testicle action integration', () => {
  // Test 1: Basic rule execution with correct perceptible event
  it('should handle suckle_testicle action with correct perceptible event', async () => {
    // Setup entities with required components
    // Dispatch action
    // Verify perceptible_event, display_successful_action_result, turn_ended events
  });

  // Test 2: Different actor/target name combinations
  it('should handle suckle_testicle action with different actor and target names', async () => {
    // Test with various name combinations
    // Verify message interpolation works correctly
  });

  // Test 3: Location context handling
  it('should include correct location in perceptible event', async () => {
    // Test with specific location IDs
    // Verify location is correctly included in event payload
  });

  // Test 4: Turn ending behavior
  it('should properly end turn after action execution', async () => {
    // Verify turn_ended event is dispatched
    // Confirm action completes successfully
  });

  // Test 5: Success result display
  it('should display successful action result', async () => {
    // Verify display_successful_action_result event
    // Test success message formatting
  });
});
```

#### Test Dependencies

- Import rule JSON: `../../../../data/mods/sex/rules/handle_suckle_testicle.rule.json`
- Import condition JSON: `../../../../data/mods/sex/conditions/event-is-action-suckle-testicle.condition.json`
- Import core macros: `../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json`
- Import macro utilities: `../../../../src/utils/macroUtils.js` (for `expandMacros`)
- Import operation handlers from: `../../../../src/logic/operationHandlers/`
  - `QueryComponentHandler`
  - `GetNameHandler`
  - `GetTimestampHandler`
  - `DispatchEventHandler`
  - `DispatchPerceptibleEventHandler`
  - `EndTurnHandler`
- Import constants:
  - `../../../../src/constants/componentIds.js` (NAME_COMPONENT_ID, POSITION_COMPONENT_ID)
  - `../../../../src/constants/eventIds.js` (ATTEMPT_ACTION_ID)
- Use test environment: `../../../common/engine/systemLogicTestEnv.js`

### 2. Additional Testing Considerations

**Action Discovery Testing**: The current codebase does NOT implement separate action discovery test files. Action discovery is validated implicitly through the integration tests when the test environment is set up with proper entity configurations.

**Rule System Testing**: The current codebase does NOT implement separate rule system integration tests in the `/tests/integration/rules/` directory specifically for individual actions. Rule behavior is tested through the action integration tests.

### Test Utilities and Setup

#### Required Test Setup

- **Entity Creation**: Create test entities with required components
  - Actor with `core:name`, `core:position`, `positioning:closeness`, `positioning:kneeling_before`
  - Target with `core:name`, `core:position`, testicle anatomy parts
- **Component Mocking**: Mock positioning and closeness systems
- **Event System**: Setup event bus and handlers for testing
- **Rule System**: Initialize rule processing with test environment

#### Test Data Requirements

- **Sample Locations**: Various location IDs for context testing
- **Character Names**: Multiple actor/target name combinations
- **Anatomy Setup**: Proper testicle part definitions and socket configurations
- **Clothing States**: Various clothing coverage scenarios

## Implementation Details

### File Creation Order

1. **Condition File**: Create condition first as it's referenced by rule
2. **Rule File**: Create rule referencing the condition
3. **Action File**: Create action referencing existing scope (scope already exists and requires no changes)
4. **Integration Test File**: Create single comprehensive test file following existing patterns

**Note**: The existing scope file `actor_kneeling_before_target_with_testicle.scope` requires NO modifications and will be reused as-is.

### Naming Conventions

- **Files**: `snake_case.action.json`, `snake_case.rule.json`, `snake_case.condition.json`
- **IDs**: `mod:identifier` format (e.g., `sex:suckle_testicle`)
- **Rule IDs**: `handle_{action_name}` format
- **Condition IDs**: `event-is-action-{action-name-with-hyphens}` format (e.g., `event-is-action-suckle-testicle`)

### Component Dependencies

The implementation relies on existing components:

- **positioning:closeness**: Manages intimate positioning between entities
- **positioning:kneeling_before**: Tracks kneeling position relative to target
- **anatomy parts**: Testicle parts with socket coverage system

### Event Flow

1. Player inputs command matching template
2. Action discovery system finds action via scope resolution
3. Action execution triggers `core:attempt_action` event with payload containing actionId and targetId
4. Rule system matches event via condition (checking `event.payload.actionId`)
5. Rule executes operations sequentially:
   - GET_NAME operations to retrieve actor and target names
   - QUERY_COMPONENT to get actor position for location context
   - SET_VARIABLE operations to prepare context variables
6. Macro `core:logSuccessAndEndTurn` expands and executes:
   - GET_TIMESTAMP for event timing
   - DISPATCH_EVENT for `core:perceptible_event` with message and location context
   - DISPATCH_EVENT for `core:display_successful_action_result`
   - END_TURN to conclude the action

## Quality Assurance

### Code Quality Requirements

- **Schema Validation**: All JSON files must validate against their respective schemas
- **Linting**: Pass ESLint validation using project configuration
- **Test Coverage**: Achieve minimum 80% branch coverage in all test files
- **Integration**: Verify compatibility with existing positioning and anatomy systems

### Testing Standards

- **Test Structure**: Follow existing test patterns from reference implementations
- **Assertions**: Use comprehensive assertions covering all event types
- **Edge Cases**: Test missing components, invalid targets, covered anatomy
- **Error Handling**: Verify graceful handling of malformed data

### Performance Considerations

- **Scope Resolution**: Reuse existing scope for optimal performance
- **Event Handling**: Leverage existing event bus patterns
- **Component Queries**: Use efficient component access patterns
- **Memory Usage**: Ensure proper cleanup in test environments

### Documentation Requirements

- **Inline Comments**: Comprehensive JSDoc comments in test files
- **File Headers**: Descriptive file purpose and dependencies
- **Test Descriptions**: Clear test case descriptions and expectations
- **Integration Notes**: Document any special integration requirements

## Conclusion

This specification provides a complete, actionable plan for implementing the "suckle testicle" action/rule combination. The implementation follows established patterns from the reference `lick_testicles_sensually` action while maintaining consistency with the Living Narrative Engine's modular architecture.

**Key Implementation Points:**

- Reuses existing `actor_kneeling_before_target_with_testicle` scope (no new scope files needed)
- Follows exact schema patterns from existing condition/rule/action files
- Uses standard `core:logSuccessAndEndTurn` macro for consistent event processing
- Implements single comprehensive integration test file (no separate discovery or rule tests)
- Maintains compatibility with existing positioning and anatomy systems

The implementation requires only **3 new files** (condition, rule, action) plus **1 test file**, demonstrating the efficiency of the engine's modular design. Upon completion, this will provide players with a new intimate action that integrates seamlessly with existing systems.
