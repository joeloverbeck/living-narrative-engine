# Specification: Squeeze Neck With Both Hands Action

## Overview

This specification defines the implementation of a new action/rule combination for the `violence` mod that allows an actor to squeeze a target's neck with both hands, representing a more intense and murderous version of the existing `grab_neck` action.

## Reference Analysis

### Base Action: `violence:grab_neck`

The reference action `violence:grab_neck` has been analyzed and provides the following patterns:

**File**: `data/mods/violence/actions/grab_neck.action.json`
- **ID**: `violence:grab_neck`
- **Targets Scope**: `positioning:close_actors_facing_each_other_or_behind_target`
- **Required Components**: Actor must have `positioning:closeness`
- **Template**: `"grab {target}'s neck"`
- **Visual Scheme**: Violence color palette (dark red background `#8b0000`, white text `#ffffff`, hover variations)

**File**: `data/mods/violence/rules/handle_grab_neck.rule.json`
- Rule ID: `handle_grab_neck`
- Event Type: `core:attempt_action`
- Condition: References `violence:event-is-action-grab-neck`
- Operations: GET_NAME (actor/target), QUERY_COMPONENT (position), SET_VARIABLE (log message), macro `core:logSuccessAndEndTurn`
- Message: `"{context.actorName} grabs {context.targetName}'s neck."`
- Perception Type: `action_target_general`

**File**: `data/mods/violence/conditions/event-is-action-grab-neck.condition.json`
- Checks: `event.payload.actionId == "violence:grab_neck"`

## New Action Specification

### Action Definition

**File**: `data/mods/violence/actions/squeeze_neck_with_both_hands.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:squeeze_neck_with_both_hands",
  "name": "Squeeze Neck With Both Hands",
  "description": "Squeeze someone's neck with both hands with murderous intent",
  "targets": "positioning:close_actors_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "squeeze {target}'s neck with both hands",
  "visual": {
    "backgroundColor": "#8b0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffebee"
  }
}
```

**Key Properties**:
- Uses the same targets scope as `grab_neck` to maintain consistency
- Requires closeness component for actor
- Template follows the specified format
- Visual scheme matches the violence mod color palette (consistent with reference)

### Condition Definition

**File**: `data/mods/violence/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:event-is-action-squeeze-neck-with-both-hands",
  "description": "Checks if the triggering event is for the 'violence:squeeze_neck_with_both_hands' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "violence:squeeze_neck_with_both_hands"
    ]
  }
}
```

### Rule Definition

**File**: `data/mods/violence/rules/handle_squeeze_neck_with_both_hands.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_squeeze_neck_with_both_hands",
  "comment": "Handles the 'violence:squeeze_neck_with_both_hands' action. Dispatches descriptive text with murderous intent and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "violence:event-is-action-squeeze-neck-with-both-hands"
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
        "value": "{context.actorName} squeezes their hands around {context.targetName}'s neck with murderous intentions, {context.actorName}'s forearms trembling from the effort."
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

**Key Features**:
- Follows the same operation structure as `handle_grab_neck`
- Message emphasizes murderous intent and physical exertion
- Uses the specified perceptible event message format
- Maintains consistency with existing violence mod patterns

## Testing Requirements

### Test Suite Structure

Following the patterns established in the reference tests, two comprehensive integration test suites must be created:

#### 1. Action Discovery Test Suite

**File**: `tests/integration/mods/violence/squeeze_neck_with_both_hands_action_discovery.test.js`

**Purpose**: Verify that the action is discoverable under correct conditions and not discoverable when requirements aren't met.

**Test Coverage Requirements**:

1. **Action Structure Validation**
   - Verify action matches expected schema
   - Confirm action ID is `violence:squeeze_neck_with_both_hands`
   - Validate template is `"squeeze {target}'s neck with both hands"`
   - Verify targets scope is `positioning:close_actors_facing_each_other_or_behind_target`
   - Confirm required components include `positioning:closeness`
   - Validate visual scheme matches violence color palette

2. **Positive Discovery Scenarios** (Action should be available)
   - When actors are close and facing each other
   - When actor stands behind target (target facing away from actor)
   - With multiple potential targets meeting requirements

3. **Negative Discovery Scenarios** (Action should NOT be available)
   - When actors lack closeness component
   - When actor faces away from target
   - When actors are not in proximity
   - When no valid targets exist

**Test Implementation Pattern**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import squeezeNeckAction from '../../../../data/mods/violence/actions/squeeze_neck_with_both_hands.action.json';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';

const ACTION_ID = 'violence:squeeze_neck_with_both_hands';

describe('violence:squeeze_neck_with_both_hands action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

    configureActionDiscovery = () => {
      // Configure scope resolver for positioning logic
      // Similar to grab_neck_action_discovery.test.js lines 21-87
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    // Tests for schema validation
  });

  describe('Action discovery scenarios', () => {
    // Positive and negative discovery tests
  });
});
```

#### 2. Action Execution Test Suite

**File**: `tests/integration/mods/violence/squeeze_neck_with_both_hands_action.test.js`

**Purpose**: Verify the rule executes correctly and generates appropriate events and messages.

**Test Coverage Requirements**:

1. **Action Execution**
   - Successfully performs squeeze neck action
   - Rule does not fire for different actions
   - Handles missing target gracefully (pre-flight validation)

2. **Event Generation**
   - Generates correct perceptible event message with murderous intent description
   - Includes correct location ID
   - Includes correct actor and target IDs
   - Sets proper perception type (`action_target_general`)

3. **Message Validation**
   - Perceptible log message matches specification
   - Success message reflects action completion
   - Message format works with different actor/target names
   - Message includes: "{actor} squeezes their hands around {target}'s neck with murderous intentions, {actor}'s forearms trembling from the effort."

**Test Implementation Pattern**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import squeezeNeckRule from '../../../../data/mods/violence/rules/handle_squeeze_neck_with_both_hands.rule.json';
import eventIsActionSqueezeNeck from '../../../../data/mods/violence/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json';

describe('Violence Mod: Squeeze Neck With Both Hands Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:squeeze_neck_with_both_hands',
      squeezeNeckRule,
      eventIsActionSqueezeNeck
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    // Tests for successful execution and error cases
  });

  describe('Event Generation', () => {
    // Tests for perceptible events
  });

  describe('Message Validation', () => {
    // Tests for message content
  });
});
```

### Test Helper Utilization

Both test suites should leverage the existing test infrastructure:

- **ModTestFixture**: Primary test fixture for mod action testing
- **ModEntityScenarios**: For creating test entities (rooms, actors)
- **clearEntityCache**: For cleaning up entity caching between tests

### Coverage Goals

- **Branch Coverage**: Minimum 80%
- **Line Coverage**: Minimum 90%
- **Function Coverage**: 100% (all rule operations must be tested)

## Implementation Checklist

### Content Files

- [ ] Create `data/mods/violence/actions/squeeze_neck_with_both_hands.action.json`
- [ ] Create `data/mods/violence/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json`
- [ ] Create `data/mods/violence/rules/handle_squeeze_neck_with_both_hands.rule.json`

### Test Files

- [ ] Create `tests/integration/mods/violence/squeeze_neck_with_both_hands_action_discovery.test.js`
  - [ ] Implement action structure validation tests
  - [ ] Implement positive discovery scenarios
  - [ ] Implement negative discovery scenarios
  - [ ] Configure scope resolver for positioning logic

- [ ] Create `tests/integration/mods/violence/squeeze_neck_with_both_hands_action.test.js`
  - [ ] Implement action execution tests
  - [ ] Implement event generation tests
  - [ ] Implement message validation tests
  - [ ] Test with multiple actor/target name combinations

### Validation

- [ ] Run `npm run test:integration` to verify all tests pass
- [ ] Verify action appears in game when conditions are met
- [ ] Validate JSON schemas for all new files
- [ ] Run `npx eslint` on all test files
- [ ] Ensure coverage meets minimum thresholds (80% branch, 90% line)

## Design Decisions

### Message Format

The perceptible event message was designed to:
- Emphasize the murderous nature of the action (differentiating from simple `grab_neck`)
- Include physical detail about trembling forearms to convey effort and intensity
- Use proper grammar and narrative quality consistent with game storytelling
- Follow the format: "{actor} squeezes their hands around {target}'s neck with murderous intentions, {actor}'s forearms trembling from the effort."

### Scope Reuse

The action reuses `positioning:close_actors_facing_each_other_or_behind_target` because:
- Maintains consistency with similar violence actions
- Squeezing requires the same proximity as grabbing
- Actor must be close enough to reach target's neck
- Position requirements (facing each other or behind) are appropriate

### Visual Consistency

The visual scheme maintains the violence mod color palette:
- Dark red background (`#8b0000`) conveys danger and violence
- White text (`#ffffff`) ensures readability
- Hover states provide appropriate UI feedback
- Consistent with existing violence mod actions

## Testing Strategy

The testing approach follows established patterns:

1. **ModTestFixture Pattern**: Leverages the comprehensive mod testing infrastructure
2. **Two-Suite Approach**: Separates discovery logic from execution logic
3. **Comprehensive Coverage**: Tests both positive and negative scenarios
4. **Integration Focus**: Tests the full action-rule-event flow
5. **Message Validation**: Ensures narrative quality and correct variable substitution

## References

### Existing Files Analyzed

- `data/mods/violence/actions/grab_neck.action.json`
- `data/mods/violence/rules/handle_grab_neck.rule.json`
- `data/mods/violence/conditions/event-is-action-grab-neck.condition.json`
- `tests/integration/mods/violence/grab_neck_action_discovery.test.js`
- `tests/integration/mods/violence/grab_neck_action.test.js`

### Documentation Referenced

- Mod Testing Guide (docs/testing/mod-testing-guide.md)
- ModTestFixture patterns from existing violence mod tests
- ECS architecture patterns from CLAUDE.md

## Success Criteria

Implementation is complete when:

1. All content files are created and valid
2. Both integration test suites pass with 100% success rate
3. Coverage thresholds are met (80% branch, 90% line)
4. Action is discoverable in-game under correct conditions
5. Action execution produces correct events and messages
6. All files pass linting and validation checks
