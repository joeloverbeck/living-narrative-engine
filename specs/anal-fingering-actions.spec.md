# Specification: Anal Fingering Actions for Sex-Anal-Penetration Mod

**Status**: Approved
**Created**: 2025-11-08
**Mod**: `sex-anal-penetration`
**Type**: Action/Rule Implementation

## Overview

Add two new action/rule combinations to the `sex-anal-penetration` mod for manual anal stimulation:

1. **Single Finger Insertion**: Insert one finger to loosen up the target's asshole
2. **Multiple Finger Insertion**: Insert three fingers to stretch the target's asshole thoroughly

## Requirements

### Functional Requirements

- **FR-1**: Both actions must be available when actor is close to target with exposed asshole accessible from behind
- **FR-2**: Actions must NOT require actor to be undressed (can be performed while clothed)
- **FR-3**: Single finger action must generate message: "{actor} inserts a finger into {primary}'s asshole, opening it up."
- **FR-4**: Multiple finger action must generate message: "{actor} pushes three fingers into {primary}'s asshole, feeling it stretching out."
- **FR-5**: Both actions must use consistent visual styling with existing mod (dark teal palette)

### Technical Requirements

- **TR-1**: Use existing scope `sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind`
- **TR-2**: Require `positioning:closeness` component on actor
- **TR-3**: Follow established file naming conventions (snake_case for actions/rules, kebab-case for conditions)
- **TR-4**: Maintain JSON schema compliance for all files
- **TR-5**: Use standard rule operation sequence with `core:logSuccessAndEndTurn` macro

### Testing Requirements

- **TEST-1**: Comprehensive action discovery tests (positive and negative scenarios)
- **TEST-2**: Rule execution validation tests
- **TEST-3**: Visual property validation
- **TEST-4**: Action metadata validation
- **TEST-5**: Prerequisite validation (verify no anatomy/clothing prerequisites)

## File Specifications

### Action Files

#### File 1: `insert_finger_into_asshole.action.json`

**Location**: `data/mods/sex-anal-penetration/actions/insert_finger_into_asshole.action.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-anal-penetration:insert_finger_into_asshole",
  "name": "Insert Finger into Asshole",
  "description": "Insert one finger into the target's asshole to loosen it up.",
  "targets": {
    "primary": {
      "scope": "sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind",
      "placeholder": "primary",
      "description": "Person to finger from behind"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "insert one finger into {primary}'s asshole",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#053b3f",
    "textColor": "#e0f7f9",
    "hoverBackgroundColor": "#075055",
    "hoverTextColor": "#f1feff"
  }
}
```

**Key Points**:
- Action ID: `sex-anal-penetration:insert_finger_into_asshole`
- Template: `"insert one finger into {primary}'s asshole"`
- Empty prerequisites array (no anatomy or clothing requirements for actor)
- Dark teal visual palette (consistent with mod)

#### File 2: `insert_multiple_fingers_into_asshole.action.json`

**Location**: `data/mods/sex-anal-penetration/actions/insert_multiple_fingers_into_asshole.action.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-anal-penetration:insert_multiple_fingers_into_asshole",
  "name": "Insert Multiple Fingers into Asshole",
  "description": "Insert multiple fingers into the target's asshole to stretch it thoroughly.",
  "targets": {
    "primary": {
      "scope": "sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind",
      "placeholder": "primary",
      "description": "Person to finger from behind"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "insert multiple fingers into {primary}'s asshole",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#053b3f",
    "textColor": "#e0f7f9",
    "hoverBackgroundColor": "#075055",
    "hoverTextColor": "#f1feff"
  }
}
```

**Key Points**:
- Action ID: `sex-anal-penetration:insert_multiple_fingers_into_asshole`
- Template: `"insert multiple fingers into {primary}'s asshole"`
- Identical structure to single finger action except for ID, name, description, template

### Condition Files

#### File 3: `event-is-action-insert-finger-into-asshole.condition.json`

**Location**: `data/mods/sex-anal-penetration/conditions/event-is-action-insert-finger-into-asshole.condition.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-anal-penetration:event-is-action-insert-finger-into-asshole",
  "description": "Checks if the triggering event is for the 'sex-anal-penetration:insert_finger_into_asshole' action.",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "sex-anal-penetration:insert_finger_into_asshole"
    ]
  }
}
```

#### File 4: `event-is-action-insert-multiple-fingers-into-asshole.condition.json`

**Location**: `data/mods/sex-anal-penetration/conditions/event-is-action-insert-multiple-fingers-into-asshole.condition.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-anal-penetration:event-is-action-insert-multiple-fingers-into-asshole",
  "description": "Checks if the triggering event is for the 'sex-anal-penetration:insert_multiple_fingers_into_asshole' action.",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "sex-anal-penetration:insert_multiple_fingers_into_asshole"
    ]
  }
}
```

**Pattern**: Standard event-action ID matching using JSON Logic

### Rule Files

#### File 5: `handle_insert_finger_into_asshole.rule.json`

**Location**: `data/mods/sex-anal-penetration/rules/handle_insert_finger_into_asshole.rule.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_insert_finger_into_asshole",
  "comment": "Handles the 'sex-anal-penetration:insert_finger_into_asshole' action, logging the perceptible event where the actor inserts a finger into the target's asshole.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-anal-penetration:event-is-action-insert-finger-into-asshole"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_id": "positioning:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{actorName} inserts a finger into {targetName}'s asshole, opening it up."
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
        "value": {
          "var": "actorPosition.locationId"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": {
          "var": "event.payload.targets.primary"
        }
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Operations**:
1. Get actor and target names
2. Query actor's position component
3. Set log message: "{actor} inserts a finger into {primary}'s asshole, opening it up."
4. Set perception type: `action_target_general`
5. Extract location ID from actor position
6. Set target ID from event payload
7. Execute `core:logSuccessAndEndTurn` macro

#### File 6: `handle_insert_multiple_fingers_into_asshole.rule.json`

**Location**: `data/mods/sex-anal-penetration/rules/handle_insert_multiple_fingers_into_asshole.rule.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_insert_multiple_fingers_into_asshole",
  "comment": "Handles the 'sex-anal-penetration:insert_multiple_fingers_into_asshole' action, logging the perceptible event where the actor inserts multiple fingers into the target's asshole.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-anal-penetration:event-is-action-insert-multiple-fingers-into-asshole"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_id": "positioning:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{actorName} pushes three fingers into {targetName}'s asshole, feeling it stretching out."
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
        "value": {
          "var": "actorPosition.locationId"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": {
          "var": "event.payload.targets.primary"
        }
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Difference**: Log message is "{actor} pushes three fingers into {primary}'s asshole, feeling it stretching out."

### Test Files

All test files follow the modern `ModTestFixture` pattern as documented in `docs/testing/mod-testing-guide.md`.

#### File 7: `insert_finger_into_asshole_action_discovery.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`

**Test Cases**:
1. Action metadata validation (ID, name, template, visual properties)
2. Visual styling consistency (dark teal palette)
3. Discovery when close actors with exposed asshole accessible from behind
4. Not discovered when actors not close
5. Not discovered when target's asshole is covered
6. No anatomy prerequisites validation
7. No clothing prerequisites validation

**Key Patterns**:
- Use `ModTestFixture.forAction('sex-anal-penetration', 'sex-anal-penetration:insert_finger_into_asshole')`
- Register positioning scopes with `ScopeResolverHelpers.registerPositioningScopes()`
- Create scenarios with `testFixture.createCloseActors()`
- Domain matchers from `tests/common/mods/domainMatchers.js`

#### File 8: `insert_finger_into_asshole_action.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action.test.js`

**Test Cases**:
1. Successfully executes insert finger into asshole action
2. Generates correct perceptible event message
3. Dispatches ACTION_SUCCEEDED event
4. Validates target from primary scope
5. Handles rule execution with proper event flow

**Key Patterns**:
- Use `testFixture.executeAction(actorId, targetId)`
- Validate event dispatching with `testFixture.testEnv.eventBus.dispatch` spy
- Assert message content matches specification

#### File 9: `insert_multiple_fingers_into_asshole_action_discovery.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

**Test Cases**: Identical structure to File 7, but for multiple fingers action

#### File 10: `insert_multiple_fingers_into_asshole_action.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action.test.js`

**Test Cases**: Identical structure to File 8, but for multiple fingers action with different message validation

### Mod Manifest Update

**File**: `data/mods/sex-anal-penetration/mod-manifest.json`

**Changes**:
Add to `content` object:

```json
{
  "content": {
    "actions": [
      "actions/tease_asshole_with_glans.action.json",
      "actions/insert_finger_into_asshole.action.json",
      "actions/insert_multiple_fingers_into_asshole.action.json"
    ],
    "conditions": [
      "conditions/event-is-action-tease-asshole-with-glans.condition.json",
      "conditions/event-is-action-insert-finger-into-asshole.condition.json",
      "conditions/event-is-action-insert-multiple-fingers-into-asshole.condition.json"
    ],
    "rules": [
      "rules/handle_tease_asshole_with_glans.rule.json",
      "rules/handle_insert_finger_into_asshole.rule.json",
      "rules/handle_insert_multiple_fingers_into_asshole.rule.json"
    ],
    "scopes": [
      "scopes/actors_with_exposed_asshole_accessible_from_behind.scope"
    ]
  }
}
```

## Visual Design Standards

### Color Palette (Dark Teal)

| Property | Value | Description |
|----------|-------|-------------|
| `backgroundColor` | `#053b3f` | Dark teal background |
| `textColor` | `#e0f7f9` | Light cyan text |
| `hoverBackgroundColor` | `#075055` | Slightly lighter teal hover |
| `hoverTextColor` | `#f1feff` | Very light cyan hover text |

**Rationale**: Maintains visual consistency with existing `sex-anal-penetration` mod actions

## Testing Strategy

### Test Organization

```
tests/integration/mods/sex-anal-penetration/
├── insert_finger_into_asshole_action_discovery.test.js
├── insert_finger_into_asshole_action.test.js
├── insert_multiple_fingers_into_asshole_action_discovery.test.js
└── insert_multiple_fingers_into_asshole_action.test.js
```

### Coverage Requirements

- **Unit Coverage**: N/A (no custom logic beyond standard rule operations)
- **Integration Coverage**: 100% of action discovery scenarios and rule execution paths
- **E2E Coverage**: Manual validation through gameplay

### Test Execution Commands

```bash
# Run all sex-anal-penetration mod tests
npm run test:integration -- tests/integration/mods/sex-anal-penetration/ --silent

# Run specific action tests
npm run test:integration -- tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole*.test.js --silent

# Run with verbose output for debugging
npm run test:integration -- tests/integration/mods/sex-anal-penetration/ --no-coverage --verbose
```

## Implementation Checklist

### Pre-Implementation
- [x] Analyze reference action (`tease_asshole_with_glans.action.json`)
- [x] Review mod structure and conventions
- [x] Study testing patterns and documentation
- [x] Create comprehensive specification document

### Implementation Phase
- [ ] Create action files (2)
  - [ ] `insert_finger_into_asshole.action.json`
  - [ ] `insert_multiple_fingers_into_asshole.action.json`
- [ ] Create condition files (2)
  - [ ] `event-is-action-insert-finger-into-asshole.condition.json`
  - [ ] `event-is-action-insert-multiple-fingers-into-asshole.condition.json`
- [ ] Create rule files (2)
  - [ ] `handle_insert_finger_into_asshole.rule.json`
  - [ ] `handle_insert_multiple_fingers_into_asshole.rule.json`
- [ ] Update mod manifest
  - [ ] Add actions to content.actions array
  - [ ] Add conditions to content.conditions array
  - [ ] Add rules to content.rules array

### Testing Phase
- [ ] Create action discovery tests (2)
  - [ ] `insert_finger_into_asshole_action_discovery.test.js`
  - [ ] `insert_multiple_fingers_into_asshole_action_discovery.test.js`
- [ ] Create rule execution tests (2)
  - [ ] `insert_finger_into_asshole_action.test.js`
  - [ ] `insert_multiple_fingers_into_asshole_action.test.js`
- [ ] Run test suite
  - [ ] `npm run test:integration -- tests/integration/mods/sex-anal-penetration/`
  - [ ] Verify all tests pass
  - [ ] Check coverage reports

### Validation Phase
- [ ] Schema validation
  - [ ] `npm run validate`
- [ ] Lint validation
  - [ ] `npx eslint data/mods/sex-anal-penetration/`
- [ ] Type checking
  - [ ] `npm run typecheck`
- [ ] Manual gameplay testing
  - [ ] Verify actions appear in action list
  - [ ] Execute single finger action
  - [ ] Execute multiple finger action
  - [ ] Verify messages display correctly

## Dependencies

### Mod Dependencies
- `anatomy` - Body part type checks
- `clothing` - Socket coverage checks
- `positioning` - Closeness and positioning components
- `sex-core` - Core sexual interaction patterns

### Technical Dependencies
- JSON Schema validation (AJV)
- ModTestFixture framework
- ScopeResolverHelpers utilities
- Jest testing framework

## Risk Assessment

### Low Risk
- Using established patterns from existing action
- No new schemas or operation types required
- Comprehensive test coverage planned

### Considerations
- Visual palette must match existing mod exactly
- Empty prerequisites array (no anatomy/clothing checks for actor)
- Messages must match specification exactly for testing validation

## Success Criteria

1. ✅ All action files validate against action schema
2. ✅ All condition files validate against condition schema
3. ✅ All rule files validate against rule schema
4. ✅ Mod manifest validates and loads successfully
5. ✅ All integration tests pass with 100% coverage
6. ✅ Actions appear correctly in gameplay
7. ✅ Messages display exactly as specified
8. ✅ Visual styling matches existing mod palette
9. ✅ No breaking changes to existing mod functionality
10. ✅ Code passes lint and type checking

## References

### Source Files
- `data/mods/sex-anal-penetration/actions/tease_asshole_with_glans.action.json` - Reference action structure
- `data/mods/sex-anal-penetration/rules/handle_tease_asshole_with_glans.rule.json` - Reference rule pattern
- `data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope` - Target scope

### Documentation
- `docs/testing/mod-testing-guide.md` - Comprehensive mod testing patterns
- `CLAUDE.md` - Project context and conventions
- `data/schemas/action.schema.json` - Action schema definition
- `data/schemas/rule.schema.json` - Rule schema definition

### Test Examples
- `tests/integration/mods/violence/grab_neck_action_discovery.test.js` - Modern test pattern
- `tests/integration/mods/positioning/` - Positioning-related test examples
- `tests/common/mods/ModTestFixture.js` - Test fixture factory
- `tests/common/mods/domainMatchers.js` - Custom matchers

---

**Specification Version**: 1.0
**Last Updated**: 2025-11-08
**Status**: Ready for Implementation
