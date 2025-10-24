# Ejaculate in Mouth Action - Technical Specification

## Overview

This specification defines a new action/rule combination for the `sex-penile-oral` mod that allows an actor receiving oral sex to ejaculate inside the target's mouth.

## Action Definition

### Metadata

- **Action ID**: `sex-penile-oral:ejaculate_in_mouth`
- **Name**: "Ejaculate in Mouth"
- **Description**: "Climax and release inside their mouth during oral pleasure"
- **Mod**: `sex-penile-oral`

### Target Configuration

#### Primary Target

- **Scope**: `sex-penile-oral:actor_giving_blowjob_to_me`
- **Placeholder**: `primary`
- **Description**: "Partner currently pleasuring you orally"

The primary target scope resolves to the entity currently giving the actor a blowjob. This scope:

- Validates bidirectional `receiving_blowjob`/`giving_blowjob` component references
- Ensures closeness is established between actors
- Does NOT filter based on kneeling status (allows kneeling scenarios)
- Returns empty set if validation fails

### Required Components

Actor must have:

- `positioning:closeness` - Ensures physical proximity with target
- `positioning:receiving_blowjob` - Confirms actor is receiving oral sex

### Forbidden Components

None specified (uses default empty object).

### Action Template

```
"ejaculate in {primary}'s mouth"
```

**Example Resolution**: "ejaculate in Ava's mouth"

### Visual Styling

Follows sex-penile-oral mod visual theme:

- **Background Color**: `#2a1a5e` (deep purple)
- **Text Color**: `#ede7f6` (light lavender)
- **Hover Background**: `#372483` (brighter purple)
- **Hover Text**: `#ffffff` (white)

## Rule Definition

### Event Binding

- **Rule ID**: `handle_ejaculate_in_mouth`
- **Event Type**: `core:attempt_action`
- **Condition Reference**: `sex-penile-oral:event-is-action-ejaculate-in-mouth`

### Condition Logic

The condition validates that the incoming event is an attempt to execute the ejaculate_in_mouth action:

```json
{
  "==": [
    { "var": "event.payload.actionId" },
    "sex-penile-oral:ejaculate_in_mouth"
  ]
}
```

### Rule Operations

The rule executes the following operations in sequence:

1. **GET_NAME** (actor) → `actorName` variable
2. **GET_NAME** (primary) → `primaryName` variable
3. **QUERY_COMPONENT** (actor position) → `actorPosition` variable
4. **SET_VARIABLE** `logMessage` →
   `"{context.actorName} groans and shudders with pleasure as they shoot a load of cum inside {context.primaryName}'s mouth."`
5. **SET_VARIABLE** `perceptionType` → `"action_target_general"`
6. **SET_VARIABLE** `locationId` → `"{context.actorPosition.locationId}"`
7. **SET_VARIABLE** `actorId` → `"{event.payload.actorId}"`
8. **SET_VARIABLE** `targetId` → `"{event.payload.primaryId}"`
9. **MACRO** `core:logSuccessAndEndTurn`

### Narrative Output

**Successful Action Message**:
```
"{actor} groans and shudders with pleasure as they shoot a load of cum inside {primary}'s mouth."
```

**Example**: "Nolan groans and shudders with pleasure as they shoot a load of cum inside Ava's mouth."

**Perceptible Event Message**: Same as successful action message

**Perception Type**: `action_target_general`

### Component State Management

**Critical Behavior**: This action does NOT remove the `positioning:receiving_blowjob` or `positioning:giving_blowjob` components. The blowjob state is maintained, allowing:

- Multiple ejaculation actions in sequence
- Continued blowjob-related actions afterward
- Realistic continuation of the sexual encounter

This differentiates it from actions like `pull_penis_out_of_mouth` which DO remove these components to end the interaction.

## File Structure

### Action File

**Path**: `data/mods/sex-penile-oral/actions/ejaculate_in_mouth.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:ejaculate_in_mouth",
  "name": "Ejaculate in Mouth",
  "description": "Climax and release inside their mouth during oral pleasure",
  "targets": {
    "primary": {
      "scope": "sex-penile-oral:actor_giving_blowjob_to_me",
      "placeholder": "primary",
      "description": "Partner currently pleasuring you orally"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:receiving_blowjob"]
  },
  "forbidden_components": {},
  "template": "ejaculate in {primary}'s mouth",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#2a1a5e",
    "textColor": "#ede7f6",
    "hoverBackgroundColor": "#372483",
    "hoverTextColor": "#ffffff"
  }
}
```

### Condition File

**Path**: `data/mods/sex-penile-oral/conditions/event-is-action-ejaculate-in-mouth.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-ejaculate-in-mouth",
  "description": "Validates that the current event is an attempt_action event for the ejaculate_in_mouth action",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "sex-penile-oral:ejaculate_in_mouth"
    ]
  }
}
```

### Rule File

**Path**: `data/mods/sex-penile-oral/rules/handle_ejaculate_in_mouth.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_ejaculate_in_mouth",
  "comment": "Handles the 'sex-penile-oral:ejaculate_in_mouth' action. Actor climaxes and ejaculates inside target's mouth. Maintains blowjob components (does not end interaction), dispatches descriptive narrative, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-penile-oral:event-is-action-ejaculate-in-mouth"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "primary", "result_variable": "primaryName" }
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
        "value": "{context.actorName} groans and shudders with pleasure as they shoot a load of cum inside {context.primaryName}'s mouth."
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
        "variable_name": "actorId",
        "value": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.primaryId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Mod Manifest Updates

**Path**: `data/mods/sex-penile-oral/mod-manifest.json`

Add to `content` arrays:

```json
{
  "content": {
    "actions": [
      "ejaculate_in_mouth.action.json"
    ],
    "conditions": [
      "event-is-action-ejaculate-in-mouth.condition.json"
    ],
    "rules": [
      "handle_ejaculate_in_mouth.rule.json"
    ]
  }
}
```

## Test Coverage Requirements

### Action Discovery Tests

**File**: `tests/integration/mods/sex-penile-oral/ejaculate_in_mouth_action_discovery.test.js`

This test suite validates that the action appears in discovery results when prerequisites are met and is correctly filtered otherwise.

#### Test Pattern

Follow the pattern established in `guide_blowjob_with_hand_action_discovery.test.js`:

- Use `ModTestFixture.forAction('sex-penile-oral', ACTION_ID)`
- Install scope resolver override for `actor_giving_blowjob_to_me`
- Use `ModEntityBuilder` to construct scenarios
- Call `fixture.discoverActions(actorId)` to test discovery
- Assert action presence/absence with `.find()` and `expect().toBeDefined()`/`.toBeUndefined()`

#### Required Test Cases

1. **Positive Discovery**
   - ✅ "appears when actor is receiving blowjob from partner"
   - Setup: Actor has `closeness` + `receiving_blowjob`, target has `giving_blowjob`
   - Expectation: Action discovered with correct template

2. **Component Validation**
   - ✅ "does not appear when actor lacks receiving_blowjob component"
   - Setup: Actor missing `receiving_blowjob`
   - Expectation: Action NOT discovered

3. **Closeness Validation**
   - ✅ "does not appear when closeness is not established"
   - Setup: Actors exist but no closeness component
   - Expectation: Action NOT discovered

4. **Reference Validation**
   - ✅ "does not appear when entity references are mismatched"
   - Setup: `receiving_blowjob.giving_entity_id` doesn't match target ID
   - Expectation: Action NOT discovered

5. **Target Component Validation**
   - ✅ "does not appear when target lacks giving_blowjob component"
   - Setup: Target missing `giving_blowjob`
   - Expectation: Action NOT discovered

6. **Kneeling Scenario (Regression)**
   - ✅ "DOES appear when target is kneeling before actor"
   - Setup: Target has `kneeling_before` component
   - Expectation: Action STILL discovered (scope allows kneeling)
   - Rationale: Validates scope doesn't filter based on posture

#### Helper Functions

**buildEjaculateInMouthScenario(options)**

Parameters:
- `includeReceivingBlowjob` (default: true)
- `includeCloseness` (default: true)
- `mismatchedReferences` (default: false)
- `targetHasGivingBlowjob` (default: true)
- `targetKneeling` (default: false)

Returns:
- `{ entities, actorId, primaryId }`

**installActorGivingBlowjobToMeScopeOverride(fixture)**

- Intercepts `sex-penile-oral:actor_giving_blowjob_to_me` scope resolution
- Validates bidirectional component references
- Checks closeness partnership
- Returns cleanup function

**configureActionDiscovery(fixture)**

- Registers action in `fixture.testEnv.actionIndex`

### Rule Execution Tests

**File**: `tests/integration/mods/sex-penile-oral/ejaculate_in_mouth_action.test.js`

This test suite validates the rule's behavior when the action is executed.

#### Test Pattern

Follow the pattern established in `guide_blowjob_with_hand_action.test.js`:

- Use `ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID)`
- Import domain matchers: `'../../common/mods/domainMatchers.js'` and `'../../common/actionMatchers.js'`
- Use `ModAssertionHelpers` for event validation
- Call `fixture.executeAction(actorId, primaryId, { additionalPayload: { primaryId } })`
- Inspect `fixture.events` and entity state via `fixture.entityManager.getEntityInstance()`

#### Required Test Cases

1. **Narrative and Event Dispatching**
   - ✅ "dispatches correct narrative message and perceptible event"
   - Execute action, validate:
     - Success message matches specification
     - Perceptible event dispatched with correct metadata
     - Turn ends (`shouldEndTurn: true`)

2. **Component Preservation**
   - ✅ "maintains blowjob components (does NOT remove them)"
   - Before: Verify `receiving_blowjob` and `giving_blowjob` exist
   - After: Verify components STILL exist with preserved data
   - Critical: Differentiates from `pull_penis_out_of_mouth` behavior

3. **Entity Isolation**
   - ✅ "does not affect other entities when ejaculating"
   - Setup: Two actor/primary pairs both engaged in blowjob
   - Execute: Action for first pair only
   - Validate: Second pair's components unchanged

4. **Action Specificity**
   - ✅ "does not fire rule for different action"
   - Dispatch `core:attempt_action` with different `actionId`
   - Validate: No success event, components unchanged

5. **State Consistency**
   - ✅ "maintains ongoing blowjob state through multiple ejaculation actions"
   - Execute action twice in sequence
   - Validate: Components preserved after each execution
   - Validate: Both executions succeed with correct narrative

#### Helper Functions

**buildEjaculateInMouthScenario()**

Returns:
- `{ entities, actorId, primaryId, roomId }`

Setup:
- Room with two actors (actor, primary)
- Actor: `closeness` + `receiving_blowjob` (references primary)
- Primary: `closeness` + `giving_blowjob` (references actor)

**installActorGivingBlowjobToMeScopeOverride(fixture)**

Same as discovery tests.

**configureActionDiscovery(fixture)**

Same as discovery tests.

#### Expected Constants

```javascript
const ACTION_ID = 'sex-penile-oral:ejaculate_in_mouth';
const EXPECTED_MESSAGE = "{actorName} groans and shudders with pleasure as they shoot a load of cum inside {primaryName}'s mouth.";
```

## Integration Points

### Existing Systems

1. **Action Discovery Service**
   - Action registered via `actionIndex.buildIndex()`
   - Scope resolution through `UnifiedScopeResolver`

2. **Rule System**
   - Condition evaluation via JSON Logic
   - Operation execution through `OperationHandlerRegistry`

3. **Event Bus**
   - Listens for: `core:attempt_action`
   - Dispatches: `core:display_successful_action_result`, `core:perceptible_event_occurred`

4. **Component System**
   - Queries: `positioning:closeness`, `positioning:receiving_blowjob`, `core:position`
   - Preserves: All blowjob-related components

### Dependencies

- **Scope**: `sex-penile-oral:actor_giving_blowjob_to_me` (existing)
- **Components**: `positioning:closeness`, `positioning:receiving_blowjob`, `positioning:giving_blowjob` (existing)
- **Macro**: `core:logSuccessAndEndTurn` (existing)

## Implementation Checklist

- [ ] Create action JSON file with correct schema and namespacing
- [ ] Create condition JSON file with actionId validation logic
- [ ] Create rule JSON file with operation sequence
- [ ] Update mod manifest with new action, condition, and rule references
- [ ] Create action discovery test suite with 6+ test cases
- [ ] Create rule execution test suite with 5+ test cases
- [ ] Install scope resolver overrides in both test files
- [ ] Import domain matchers in rule execution tests
- [ ] Verify all tests pass with `npm run test:integration`
- [ ] Run ESLint on new test files: `npx eslint tests/integration/mods/sex-penile-oral/ejaculate_in_mouth*.test.js`
- [ ] Verify mod loads correctly in game

## Success Criteria

1. **Action Definition**
   - ✅ Valid JSON schema compliance
   - ✅ Correct namespacing (`sex-penile-oral:`)
   - ✅ Primary target uses existing scope
   - ✅ Required components correctly specified

2. **Rule Definition**
   - ✅ Condition references correct action ID
   - ✅ Narrative message follows mod conventions
   - ✅ Perceptible event dispatched with metadata
   - ✅ Components preserved (not removed)

3. **Test Coverage**
   - ✅ Discovery tests cover all validation paths
   - ✅ Execution tests cover narrative, events, and state
   - ✅ Edge cases tested (kneeling, isolation, specificity)
   - ✅ 100% test passage rate

4. **Code Quality**
   - ✅ ESLint compliance
   - ✅ Follows project patterns and conventions
   - ✅ Proper test cleanup and lifecycle management

## References

### Similar Actions (for pattern reference)

- `sex-penile-oral:guide_blowjob_with_hand` - Component preservation pattern
- `sex-penile-oral:suck_penis_hard` - Intensity action during blowjob
- `sex-penile-oral:pull_penis_out_of_mouth` - Component removal pattern (contrast)

### Documentation

- [Mod Testing Guide](../docs/testing/mod-testing-guide.md) - Test infrastructure
- [Action Discovery Testing Toolkit](../docs/testing/action-discovery-testing-toolkit.md) - Discovery patterns
- [CLAUDE.md](../CLAUDE.md) - Project conventions

### Test Utilities

- `ModTestFixture` - Action test harness
- `ModEntityBuilder` - Entity construction
- `ModAssertionHelpers` - Event validation
- Domain matchers - Readable assertions
