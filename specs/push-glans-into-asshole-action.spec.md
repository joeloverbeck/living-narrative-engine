# Specification: Push Glans Into Asshole Action - Anal Sex Initiation

**Status**: Draft
**Created**: 2025-11-08
**Mods**: `sex-anal-penetration`, `positioning`
**Type**: Action/Rule Implementation with Component-Based State Management

## Overview

Add a new action/rule combination to initiate anal sex by pushing the actor's glans into the target's asshole. This action establishes a component-based state similar to the blowjob system, creating reciprocal `fucking_anally` and `being_fucked_anally` components that inform other mods about ongoing anal sex.

## Requirements

### Functional Requirements

- **FR-1**: Action must be available when actor is close to target with exposed asshole accessible from behind
- **FR-2**: Actor must have an uncovered penis to perform this action
- **FR-3**: Action must establish reciprocal component state on both participants
- **FR-4**: Components must reference each other's entity IDs for bidirectional validation
- **FR-5**: Perceptible event message: "{actor} pushes their glans against {primary}'s asshole until the sphincter opens up and the glans pops inside."
- **FR-6**: Successful action message: "{actor} pushes their glans against {primary}'s asshole until the sphincter opens up and the glans pops inside."
- **FR-7**: Components must be created in `positioning` mod to allow cross-mod awareness
- **FR-8**: Must clean up existing anal sex state before establishing new state

### Technical Requirements

- **TR-1**: Use existing scope `sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind`
- **TR-2**: Require `positioning:closeness` component on actor
- **TR-3**: Prerequisites identical to `tease_asshole_with_glans.action.json` (uncovered penis)
- **TR-4**: Visual scheme identical to `tease_asshole_with_glans.action.json` (dark teal palette)
- **TR-5**: Follow established file naming conventions (snake_case for actions/rules, kebab-case for conditions)
- **TR-6**: Maintain JSON schema compliance for all files
- **TR-7**: Use standard rule operation sequence with component cleanup and establishment
- **TR-8**: Include `REGENERATE_DESCRIPTION` operations after component changes

### Component Requirements

#### New Component: `fucking_anally.component.json`

**Location**: `data/mods/positioning/components/fucking_anally.component.json`

**Purpose**: Marks an actor who is actively penetrating another entity's asshole anally, preventing conflicting genital actions.

**Data Schema**:
```json
{
  "being_fucked_entity_id": "string (required)",
  "initiated": "boolean (required)",
  "consented": "boolean (default: true)",
  "activityMetadata": {
    "shouldDescribeInActivity": true,
    "template": "{actor} is anally penetrating {target}",
    "targetRole": "being_fucked_entity_id",
    "priority": 82
  }
}
```

**Key Points**:
- Higher priority (82) than `giving_blowjob` (80) for explicit sexual hierarchy
- References the entity being penetrated via `being_fucked_entity_id`
- Tracks whether actor initiated the interaction

#### New Component: `being_fucked_anally.component.json`

**Location**: `data/mods/positioning/components/being_fucked_anally.component.json`

**Purpose**: Marks an entity currently receiving anal penetration, signaling that other conflicting asshole/genital actions are unavailable.

**Data Schema**:
```json
{
  "fucking_entity_id": "string (required)",
  "consented": "boolean (default: true)",
  "activityMetadata": {
    "shouldDescribeInActivity": true,
    "template": "{actor} is being anally penetrated by {target}",
    "targetRole": "fucking_entity_id",
    "priority": 80
  }
}
```

**Key Points**:
- Priority (80) same as `receiving_blowjob` for passive sexual act
- References the penetrating entity via `fucking_entity_id`
- Tracks consent state

### Testing Requirements

- **TEST-1**: Comprehensive action discovery tests (positive and negative scenarios)
- **TEST-2**: Rule execution validation tests with component verification
- **TEST-3**: Visual property validation
- **TEST-4**: Component cleanup when initiating with new partner
- **TEST-5**: Prerequisite validation (actor needs uncovered penis)
- **TEST-6**: Forbidden component validation (prevent action during existing anal sex)
- **TEST-7**: State isolation (multiple simultaneous anal sex interactions)

## File Specifications

### Component Files

#### File 1: `fucking_anally.component.json`

**Location**: `data/mods/positioning/components/fucking_anally.component.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:fucking_anally",
  "description": "Marks an actor who is actively penetrating another entity's asshole, preventing conflicting genital actions.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["being_fucked_entity_id", "initiated"],
    "properties": {
      "being_fucked_entity_id": {
        "type": "string",
        "description": "The ID of the entity being anally penetrated",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "initiated": {
        "type": "boolean",
        "description": "Whether this entity initiated the anal penetration"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether the penetrating entity consents to continue the interaction",
        "default": true
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions."
          },
          "template": {
            "type": "string",
            "default": "{actor} is anally penetrating {target}",
            "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
          },
          "targetRole": {
            "type": "string",
            "default": "being_fucked_entity_id",
            "description": "Property name in this component's data containing the target entity ID."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 82,
            "description": "Display priority for activity ordering. Higher values appear first. Very high priority (82) for highly explicit sexual act, higher than oral sex (80)."
          }
        }
      }
    }
  }
}
```

#### File 2: `being_fucked_anally.component.json`

**Location**: `data/mods/positioning/components/being_fucked_anally.component.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:being_fucked_anally",
  "description": "Marks an entity currently receiving anal penetration, signaling that other conflicting asshole/genital actions are unavailable.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["fucking_entity_id"],
    "properties": {
      "fucking_entity_id": {
        "type": "string",
        "description": "The ID of the entity performing anal penetration",
        "pattern": "^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$"
      },
      "consented": {
        "type": "boolean",
        "description": "Whether this entity consents to continue receiving anal penetration",
        "default": true
      },
      "activityMetadata": {
        "type": "object",
        "description": "Inline metadata for activity description generation.",
        "additionalProperties": false,
        "properties": {
          "shouldDescribeInActivity": {
            "type": "boolean",
            "default": true,
            "description": "Whether this component should be included in activity descriptions."
          },
          "template": {
            "type": "string",
            "default": "{actor} is being anally penetrated by {target}",
            "description": "Template string with placeholders: {actor} for the entity with this component, {target} for the entity referenced by targetRole property"
          },
          "targetRole": {
            "type": "string",
            "default": "fucking_entity_id",
            "description": "Property name in this component's data containing the target entity ID."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "default": 80,
            "description": "Display priority for activity ordering. Higher values appear first. High priority (80) for passive sexual act, same as receiving oral sex."
          }
        }
      }
    }
  }
}
```

### Action File

#### File 3: `push_glans_into_asshole.action.json`

**Location**: `data/mods/sex-anal-penetration/actions/push_glans_into_asshole.action.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-anal-penetration:push_glans_into_asshole",
  "name": "Push Glans Into Asshole",
  "description": "Push your glans against the target's asshole until the sphincter opens up and the glans pops inside, initiating anal sex.",
  "targets": {
    "primary": {
      "scope": "sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind",
      "placeholder": "primary",
      "description": "Person to penetrate anally from behind"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["positioning:fucking_anally"]
  },
  "template": "push your glans into {primary}'s asshole",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "penis"]
      },
      "failure_message": "You need a penis to perform this action."
    },
    {
      "logic": {
        "not": {
          "isSocketCovered": ["actor", "penis"]
        }
      },
      "failure_message": "Your penis must be uncovered to perform this action."
    }
  ],
  "visual": {
    "backgroundColor": "#053b3f",
    "textColor": "#e0f7f9",
    "hoverBackgroundColor": "#075055",
    "hoverTextColor": "#f1feff"
  }
}
```

**Key Points**:
- Action ID: `sex-anal-penetration:push_glans_into_asshole`
- Template: `"push your glans into {primary}'s asshole"`
- Prerequisites identical to `tease_asshole_with_glans.action.json`
- Dark teal visual palette (consistent with mod)
- Forbidden component prevents action during existing anal sex

### Condition File

#### File 4: `event-is-action-push-glans-into-asshole.condition.json`

**Location**: `data/mods/sex-anal-penetration/conditions/event-is-action-push-glans-into-asshole.condition.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-anal-penetration:event-is-action-push-glans-into-asshole",
  "description": "Checks if the triggering event is for the 'sex-anal-penetration:push_glans_into_asshole' action.",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "sex-anal-penetration:push_glans_into_asshole"
    ]
  }
}
```

### Rule File

#### File 5: `handle_push_glans_into_asshole.rule.json`

**Location**: `data/mods/sex-anal-penetration/rules/handle_push_glans_into_asshole.rule.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_push_glans_into_asshole",
  "comment": "Handles the 'sex-anal-penetration:push_glans_into_asshole' action. Cleans up existing anal sex state, adds reciprocal fucking_anally/being_fucked_anally components, dispatches descriptive text, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-anal-penetration:event-is-action-push-glans-into-asshole"
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
        "entity_ref": "primary",
        "result_variable": "primaryName"
      }
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
      "type": "QUERY_COMPONENTS",
      "parameters": {
        "entity_ref": "actor",
        "pairs": [
          {
            "component_type": "positioning:fucking_anally",
            "result_variable": "actorExistingFuckingAnallyComponent"
          },
          {
            "component_type": "positioning:being_fucked_anally",
            "result_variable": "actorExistingBeingFuckedAnallyComponent"
          }
        ]
      }
    },
    {
      "type": "QUERY_COMPONENTS",
      "parameters": {
        "entity_ref": "primary",
        "pairs": [
          {
            "component_type": "positioning:fucking_anally",
            "result_variable": "primaryExistingFuckingAnallyComponent"
          },
          {
            "component_type": "positioning:being_fucked_anally",
            "result_variable": "primaryExistingBeingFuckedAnallyComponent"
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "var": "context.actorExistingFuckingAnallyComponent"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.actorExistingFuckingAnallyComponent.being_fucked_entity_id}",
              "component_type": "positioning:being_fucked_anally"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "var": "context.actorExistingBeingFuckedAnallyComponent"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.actorExistingBeingFuckedAnallyComponent.fucking_entity_id}",
              "component_type": "positioning:fucking_anally"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "var": "context.primaryExistingFuckingAnallyComponent"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.primaryExistingFuckingAnallyComponent.being_fucked_entity_id}",
              "component_type": "positioning:being_fucked_anally"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "var": "context.primaryExistingBeingFuckedAnallyComponent"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.primaryExistingBeingFuckedAnallyComponent.fucking_entity_id}",
              "component_type": "positioning:fucking_anally"
            }
          }
        ]
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:fucking_anally"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:being_fucked_anally"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:fucking_anally"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:being_fucked_anally"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:fucking_anally",
        "value": {
          "being_fucked_entity_id": "{event.payload.primaryId}",
          "initiated": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:being_fucked_anally",
        "value": {
          "fucking_entity_id": "{event.payload.actorId}",
          "consented": true
        }
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "parameters": {
        "entity_ref": "actor"
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "parameters": {
        "entity_ref": "primary"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} pushes their glans against {context.primaryName}'s asshole until the sphincter opens up and the glans pops inside."
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
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Operations**:
1. Get actor and primary names
2. Query actor's position component
3. Query existing anal sex components on both participants
4. Clean up existing anal sex state (if any) with partners
5. Remove all anal sex components from both participants
6. Add `fucking_anally` component to actor
7. Add `being_fucked_anally` component to primary
8. Regenerate descriptions for both entities
9. Set log message and perception metadata
10. Execute `core:logSuccessAndEndTurn` macro

### Test Files

#### File 6: `push_glans_into_asshole_action_discovery.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action_discovery.test.js`

**Test Cases**:
1. Action metadata validation (ID, name, template, visual properties)
2. Visual styling consistency (dark teal palette)
3. Discovery when close actors with exposed asshole accessible from behind
4. Not discovered when actors not close
5. Not discovered when target's asshole is covered
6. Not discovered when actor's penis is covered
7. Not discovered when actor lacks penis anatomy
8. Not discovered when actor already has `fucking_anally` component
9. Prerequisite validation (actor needs uncovered penis)

**Key Patterns**:
- Use `ModTestFixture.forAction('sex-anal-penetration', 'sex-anal-penetration:push_glans_into_asshole')`
- Register positioning scopes with `ScopeResolverHelpers.registerPositioningScopes()`
- Manual setup for custom scope `sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind`
- Domain matchers from `tests/common/mods/domainMatchers.js`

**Test Structure**:
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';

describe('sex-anal-penetration:push_glans_into_asshole - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:push_glans_into_asshole'
    );

    // Register standard positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load positioning condition for custom scope
    const positioningCondition = await import(
      '../../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json',
      { assert: { type: 'json' } }
    );

    // Extend dataRegistry mock
    const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;
    testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((conditionId) => {
      if (conditionId === 'positioning:actor-in-entity-facing-away') {
        return positioningCondition.default;
      }
      return originalGetCondition(conditionId);
    });

    // Load and parse custom scope
    const scopePath = path.join(
      process.cwd(),
      'data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // Create ScopeEngine and register resolver
    const scopeEngine = new ScopeEngine();
    for (const [scopeName, scopeAst] of parsedScopes) {
      const scopeResolver = (context) => {
        const runtimeCtx = {
          entityManager: testFixture.testEnv.entityManager,
          jsonLogicEval: testFixture.testEnv.jsonLogic,
          logger: testFixture.testEnv.logger,
        };
        const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);
        return { success: true, value: result };
      };

      ScopeResolverHelpers._registerResolvers(
        testFixture.testEnv,
        testFixture.testEnv.entityManager,
        { [scopeName]: scopeResolver }
      );
    }
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  // Test cases implementation...
});
```

#### File 7: `push_glans_into_asshole_action.test.js`

**Location**: `tests/integration/mods/sex-anal-penetration/push_glans_into_asshole_action.test.js`

**Test Cases**:
1. Dispatches correct perceptible event and narrative message
2. Establishes reciprocal anal sex components on both participants
3. Cleans up existing anal sex state when initiating with new partner
4. Does not fire rule for different action
5. Maintains ongoing anal sex state for correct pair
6. Validates component data (entity ID references)

**Key Patterns**:
- Use `testFixture.executeAction(actorId, targetId)`
- Validate event dispatching with event matchers
- Assert component presence and data with `toHaveComponent` and `toHaveComponentData`
- Test state cleanup with complex multi-entity scenarios

### Manifest Updates

#### positioning mod manifest

**File**: `data/mods/positioning/mod-manifest.json`

**Changes**:
Add to `content.components` array:
```json
{
  "content": {
    "components": [
      "components/fucking_anally.component.json",
      "components/being_fucked_anally.component.json"
    ]
  }
}
```

#### sex-anal-penetration mod manifest

**File**: `data/mods/sex-anal-penetration/mod-manifest.json`

**Changes**:
Add to `content` object:
```json
{
  "content": {
    "actions": [
      "actions/tease_asshole_with_glans.action.json",
      "actions/insert_finger_into_asshole.action.json",
      "actions/insert_multiple_fingers_into_asshole.action.json",
      "actions/push_glans_into_asshole.action.json"
    ],
    "conditions": [
      "conditions/event-is-action-tease-asshole-with-glans.condition.json",
      "conditions/event-is-action-insert-finger-into-asshole.condition.json",
      "conditions/event-is-action-insert-multiple-fingers-into-asshole.condition.json",
      "conditions/event-is-action-push-glans-into-asshole.condition.json"
    ],
    "rules": [
      "rules/handle_tease_asshole_with_glans.rule.json",
      "rules/handle_insert_finger_into_asshole.rule.json",
      "rules/handle_insert_multiple_fingers_into_asshole.rule.json",
      "rules/handle_push_glans_into_asshole.rule.json"
    ],
    "scopes": [
      "scopes/actors_with_exposed_asshole_accessible_from_behind.scope"
    ]
  }
}
```

## Visual Design Standards

### Color Palette (Dark Teal)

Identical to `tease_asshole_with_glans.action.json`:

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
├── push_glans_into_asshole_action_discovery.test.js
└── push_glans_into_asshole_action.test.js
```

### Coverage Requirements

- **Component Coverage**: 100% of component schemas validated
- **Integration Coverage**: 100% of action discovery scenarios and rule execution paths
- **State Management Coverage**: 100% of component cleanup and establishment logic
- **E2E Coverage**: Manual validation through gameplay

### Test Execution Commands

```bash
# Run all sex-anal-penetration mod tests
npm run test:integration -- tests/integration/mods/sex-anal-penetration/ --silent

# Run specific action tests
npm run test:integration -- tests/integration/mods/sex-anal-penetration/push_glans_into_asshole*.test.js --silent

# Run with verbose output for debugging
npm run test:integration -- tests/integration/mods/sex-anal-penetration/ --no-coverage --verbose
```

## Component Design Rationale

### Why in `positioning` mod?

The `fucking_anally` and `being_fucked_anally` components are placed in the `positioning` mod (not `sex-anal-penetration`) for the following reasons:

1. **Cross-Mod Awareness**: Other mods (intimacy, affection, kissing, etc.) need to know when actors are engaged in anal sex to filter out conflicting actions
2. **Established Pattern**: Follows the same pattern as `giving_blowjob` and `receiving_blowjob` components
3. **Dependency Chain**: Positioning is a core dependency for most sexual interaction mods
4. **Scope Filtering**: Allows other mods to filter scopes using these components without circular dependencies

### Component Naming

- **`fucking_anally`**: Active role, matches established pattern of "verb+ing" for active components
- **`being_fucked_anally`**: Passive role, matches pattern of "being_verb+ed" for passive components
- **Field Names**: Use `being_fucked_entity_id` and `fucking_entity_id` for clarity and consistency

### Priority Hierarchy

Activity description priorities establish sexual act hierarchy:

1. **82**: `fucking_anally` (active anal penetration) - highest priority
2. **80**: `being_fucked_anally`, `giving_blowjob` (explicit sexual acts)
3. **78**: `receiving_blowjob` (passive oral)
4. Lower: Other sexual/intimate components

## Implementation Checklist

### Pre-Implementation
- [x] Analyze reference components (`giving_blowjob`, `receiving_blowjob`)
- [x] Analyze reference action (`tease_asshole_with_glans`)
- [x] Analyze reference rule (`handle_take_penis_in_mouth`)
- [x] Review mod structure and conventions
- [x] Study testing patterns and documentation
- [x] Create comprehensive specification document

### Component Implementation
- [ ] Create `fucking_anally.component.json` in positioning mod
- [ ] Create `being_fucked_anally.component.json` in positioning mod
- [ ] Update positioning mod manifest
  - [ ] Add components to content.components array
- [ ] Validate component schemas
  - [ ] `npm run validate`

### Action Implementation
- [ ] Create `push_glans_into_asshole.action.json`
- [ ] Create `event-is-action-push-glans-into-asshole.condition.json`
- [ ] Create `handle_push_glans_into_asshole.rule.json`
- [ ] Update sex-anal-penetration mod manifest
  - [ ] Add action to content.actions array
  - [ ] Add condition to content.conditions array
  - [ ] Add rule to content.rules array
- [ ] Validate action/condition/rule schemas
  - [ ] `npm run validate`

### Testing Phase
- [ ] Create action discovery test
  - [ ] `push_glans_into_asshole_action_discovery.test.js`
  - [ ] Test metadata validation
  - [ ] Test visual styling
  - [ ] Test discovery scenarios (positive/negative)
  - [ ] Test prerequisite validation
  - [ ] Test forbidden component validation
- [ ] Create rule execution test
  - [ ] `push_glans_into_asshole_action.test.js`
  - [ ] Test perceptible event dispatch
  - [ ] Test component establishment
  - [ ] Test component cleanup with existing state
  - [ ] Test state isolation
  - [ ] Test component data validation
- [ ] Run test suite
  - [ ] `npm run test:integration -- tests/integration/mods/sex-anal-penetration/`
  - [ ] Verify all tests pass
  - [ ] Check coverage reports

### Validation Phase
- [ ] Schema validation
  - [ ] `npm run validate`
- [ ] Lint validation
  - [ ] `npx eslint data/mods/sex-anal-penetration/`
  - [ ] `npx eslint data/mods/positioning/components/`
- [ ] Type checking
  - [ ] `npm run typecheck`
- [ ] Manual gameplay testing
  - [ ] Verify action appears in action list
  - [ ] Execute action and verify components established
  - [ ] Verify message displays correctly
  - [ ] Verify other actions respect forbidden components
  - [ ] Test with multiple actors in various states

## Dependencies

### Mod Dependencies
- `anatomy` - Body part type checks (`hasPartOfType`)
- `clothing` - Socket coverage checks (`isSocketCovered`)
- `positioning` - Closeness, facing, and positioning components
- `sex-core` - Core sexual interaction patterns

### Technical Dependencies
- JSON Schema validation (AJV)
- ModTestFixture framework
- ScopeResolverHelpers utilities
- Jest testing framework
- ScopeEngine for custom scope resolution

## Risk Assessment

### Medium Risk
- New components in positioning mod affect multiple mods
- State cleanup logic must handle edge cases correctly
- Component priority hierarchy must be carefully maintained

### Low Risk
- Using established patterns from blowjob system
- No new schemas or operation types required
- Comprehensive test coverage planned
- Visual palette matches existing mod

### Mitigations
- Extensive testing of component cleanup logic
- State isolation tests with multiple simultaneous interactions
- Manual gameplay validation
- Follow exact patterns from proven blowjob implementation

## Success Criteria

1. ✅ Component files validate against component schema
2. ✅ Action file validates against action schema
3. ✅ Condition file validates against condition schema
4. ✅ Rule file validates against rule schema
5. ✅ Both mod manifests validate and load successfully
6. ✅ All integration tests pass with 100% coverage
7. ✅ Action appears correctly in gameplay
8. ✅ Components establish correctly with proper entity references
9. ✅ Component cleanup works correctly with existing state
10. ✅ Messages display exactly as specified
11. ✅ Visual styling matches existing mod palette
12. ✅ No breaking changes to existing mod functionality
13. ✅ Code passes lint and type checking
14. ✅ Other mods can use components for action filtering

## References

### Source Files - Components
- `data/mods/positioning/components/giving_blowjob.component.json` - Reference component structure
- `data/mods/positioning/components/receiving_blowjob.component.json` - Reference component structure

### Source Files - Actions/Rules
- `data/mods/sex-anal-penetration/actions/tease_asshole_with_glans.action.json` - Reference action structure
- `data/mods/sex-anal-penetration/rules/handle_tease_asshole_with_glans.rule.json` - Reference rule pattern
- `data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json` - Reference component establishment
- `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json` - Reference state management pattern
- `data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope` - Target scope

### Documentation
- `docs/testing/mod-testing-guide.md` - Comprehensive mod testing patterns
- `CLAUDE.md` - Project context and conventions
- `data/schemas/component.schema.json` - Component schema definition
- `data/schemas/action.schema.json` - Action schema definition
- `data/schemas/rule.schema.json` - Rule schema definition

### Test Examples
- `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action.test.js` - Component establishment pattern
- `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_action_discovery.test.js` - Discovery test pattern
- `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js` - Custom scope setup pattern
- `tests/common/mods/ModTestFixture.js` - Test fixture factory
- `tests/common/mods/domainMatchers.js` - Custom matchers

---

**Specification Version**: 1.0
**Last Updated**: 2025-11-08
**Status**: Ready for Review
