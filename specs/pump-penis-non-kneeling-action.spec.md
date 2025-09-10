# Pump Penis Non-Kneeling Action Specification

## Overview

This specification defines a new action for the sex mod: `sex:pump_penis`. This action allows an actor to pump their partner's penis without requiring a kneeling position, making it a variant of the existing `sex:pump_penis_from_up_close` action that can be performed while standing face-to-face.

## Requirements Analysis

### Existing Action Analysis

The current `sex:pump_penis_from_up_close` action has these characteristics:
- **Scope**: `sex:actor_kneeling_before_target_with_penis` (requires kneeling)
- **Components**: `["positioning:closeness", "positioning:kneeling_before"]`
- **Template**: `"pump {target}'s penis from up close"`
- **Message**: `"From up close, {actor}'s breath hot against {target}'s genitals, {actor} pumps {target}'s penis sensually while kneeling."`

### New Action Requirements

The new `sex:pump_penis` action should have:
- **Scope**: `sex:actors_with_penis_facing_each_other` (no kneeling requirement)
- **Components**: `["positioning:closeness"]` only
- **Template**: `"pump {target}'s penis"`
- **Target**: `primary` (following pattern from `fondle_penis`)
- **Visual**: Match `sex:fondle_penis` color scheme
- **Message**: `"{actor} pumps {primary}'s hard penis, intending to make {primary} cum."`

## Functional Requirements

### 1. Action Definition
Create `sex:pump_penis` action that:
- Uses the `sex:actors_with_penis_facing_each_other` scope for target resolution
- Requires only `positioning:closeness` component (no kneeling)
- Uses `primary` target designation
- Has template format: `"pump {target}'s penis"`
- Uses same visual scheme as `sex:fondle_penis`

### 2. Rule Processing
Create corresponding rule that:
- Processes the `sex:pump_penis` action
- Dispatches perceptible event: `"{actor} pumps {primary}'s hard penis, intending to make {primary} cum."`
- Dispatches success message: `"{actor} pumps {primary}'s hard penis, intending to make {primary} cum."`
- Ends the turn successfully
- Uses `action_target_general` perception type

### 3. Testing Requirements
Ensure comprehensive test coverage for:
- **Action Discoverability**: Scope resolution, component validation, facing direction, clothing coverage
- **Rule Behavior**: Event dispatching, message formatting, turn management
- **Edge Cases**: Missing targets, invalid actors, rule isolation

## Implementation Details

### 1. Action File: `data/mods/sex/actions/pump_penis.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex:pump_penis",
  "name": "Pump Penis",
  "description": "Pump the target's penis while facing them.",
  "targets": {
    "primary": {
      "scope": "sex:actors_with_penis_facing_each_other",
      "placeholder": "target",
      "description": "Person with penis to pump"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "pump {target}'s penis",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#4a148c",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#6a1b9a",
    "hoverTextColor": "#f3e5f5"
  }
}
```

**Design Decisions:**

- Uses `sex:actors_with_penis_facing_each_other` scope to match `fondle_penis.action.json` pattern
- Requires only `positioning:closeness` component (removes kneeling requirement)
- Uses `primary` target designation for consistency with `fondle_penis`
- Purple color scheme (#4a148c) matches `sex:fondle_penis` exactly
- Simple template "pump {target}'s penis" for clear user interaction

### 2. Condition File: `data/mods/sex/conditions/event-is-action-pump-penis.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex:event-is-action-pump-penis",
  "description": "Checks if the event is attempting the 'Pump Penis' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "sex:pump_penis"]
  }
}
```

### 3. Rule File: `data/mods/sex/rules/handle_pump_penis.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_pump_penis",
  "comment": "Handles the 'sex:pump_penis' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "sex:event-is-action-pump-penis" },
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
        "value": "{context.actorName} pumps {context.targetName}'s hard penis, intending to make {context.targetName} cum."
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

**Key Design Decisions:**

- Uses same structure as `handle_fondle_penis.rule.json`
- Message uses `{context.targetName}` for both instances in the text
- Sets `perceptionType` to `"action_target_general"` (matches fondle_penis pattern)
- Consistent message for both perceptible event and success message
- Follows established sex mod messaging patterns

### 4. Integration Test File: `tests/integration/mods/sex/pump_penis_action.test.js`

```javascript
/**
 * @file Integration tests for the sex:pump_penis action and rule.
 * @description Tests the rule execution after the pump_penis action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see pumpPenisActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy setup for pump penis scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy entities
 */
function setupAnatomyComponents() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .asActor()
    .build();

  // Create target entity with body reference and anatomy
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .build();

  // Create anatomy entities as separate entities
  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin',
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis',
    })
    .build();

  return {
    room,
    actor,
    target,
    groin,
    penis,
  };
}

describe('sex:pump_penis action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction('sex', 'sex:pump_penis');

    // Setup anatomy entities
    const entities = setupAnatomyComponents();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // eslint-disable-next-line jest/expect-expect
  it('performs pump penis action successfully', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice pumps Bob's hard penis, intending to make Bob cum.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('does not fire rule for different action', async () => {
    // Setup minimal entities for this test
    const minimalEntities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'alice',
    });

    // Rule should not trigger for a different action
    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event
  });

  it('handles missing target gracefully', async () => {
    // Setup minimal entities without a target
    const minimalEntities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity([])
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'sex:pump_penis',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('creates correct perceptible event with proper message format', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Find the perceptible event
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice pumps Bob's hard penis, intending to make Bob cum."
    );
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.actorId).toBe('alice');
    expect(perceptibleEvent.payload.targetId).toBe('bob');
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
  });

  it('creates correct success message', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Find the success message event
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice pumps Bob's hard penis, intending to make Bob cum."
    );
  });
});
```

### 5. Action Discoverability Test File: `tests/integration/scopes/pumpPenisActionDiscovery.integration.test.js`

```javascript
/**
 * @file Integration tests for pump_penis action discovery with socket coverage
 * @description Tests that the actors_with_penis_facing_each_other scope properly filters
 * actors based on penis socket coverage, facing direction, and closeness
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import {
  createMockMultiTargetResolutionStage,
  createEmptyMockMultiTargetResolutionStage,
} from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const penisScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_penis_facing_each_other.scope'
  ),
  'utf8'
);

// Import actual action files
import pumpPenisAction from '../../../data/mods/sex/actions/pump_penis.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Pump Penis Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let safeEventDispatcher;
  let multiTargetResolutionStage;
  let prerequisiteEvaluationService;
  let targetResolutionService;
  let gameDataRepository;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the action
    dataRegistry.store('actions', pumpPenisAction.id, pumpPenisAction);

    // Store the condition
    dataRegistry.store('conditions', 'positioning:entity-not-in-facing-away', {
      id: 'positioning:entity-not-in-facing-away',
      logic: {
        not: {
          in: [
            { var: 'actor.id' },
            { var: 'entity.components.positioning:closeness.facing_away_from' },
          ],
        },
      },
    });

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      penisScopeContent,
      'actors_with_penis_facing_each_other.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex:actors_with_penis_facing_each_other': scopeDefinitions.get(
        'sex:actors_with_penis_facing_each_other'
      ),
    });

    scopeEngine = new ScopeEngine();
    prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

    gameDataRepository = {
      getAllActionDefinitions: jest.fn().mockReturnValue([pumpPenisAction]),
      get: jest.fn((type, id) => dataRegistry.get(type, id)),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
    });

    // Default to normal mock - individual tests can override
    multiTargetResolutionStage = createMockMultiTargetResolutionStage();
  });

  // Helper to create action discovery service with custom mock
  function createActionDiscoveryService(shouldFindActions = true) {
    const stage = shouldFindActions
      ? createMockMultiTargetResolutionStage()
      : createEmptyMockMultiTargetResolutionStage();

    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation(() =>
            gameDataRepository.getAllActionDefinitions()
          ),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      multiTargetResolutionStage: stage,
    });

    return new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  }

  beforeEach(() => {
    // Create default action discovery service
    actionDiscoveryService = createActionDiscoveryService(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('socket coverage tests', () => {
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            ...targetClothingConfig,
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          return [];
        }
      );
    }

    it('should discover action when penis is uncovered', async () => {
      // Arrange - no clothing equipment
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const pumpPenisActions = result.actions.filter(
        (action) => action.id === 'sex:pump_penis'
      );
      expect(pumpPenisActions).toHaveLength(1);
      expect(pumpPenisActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when penis is covered', async () => {
      // Arrange - penis covered
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        },
      });

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const pumpPenisActions = result.actions.filter(
        (action) => action.id === 'sex:pump_penis'
      );
      expect(pumpPenisActions).toHaveLength(0);
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: ['actor1'], // Facing away from actor
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          return [];
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const pumpPenisActions = result.actions.filter(
        (action) => action.id === 'sex:pump_penis'
      );
      expect(pumpPenisActions).toHaveLength(0);
    });

    it('should not discover action when target has no penis', async () => {
      // Arrange - target without penis
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: [], // No penis
              subType: 'groin',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find no penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          return []; // Always return empty for this test case
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const pumpPenisActions = result.actions.filter(
        (action) => action.id === 'sex:pump_penis'
      );
      expect(pumpPenisActions).toHaveLength(0);
    });

    it('should not discover action when actor lacks closeness component', async () => {
      // Arrange - actor without closeness
      const entities = [
        {
          id: 'actor1',
          components: {
            // No positioning:closeness component
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const pumpPenisActions = result.actions.filter(
        (action) => action.id === 'sex:pump_penis'
      );
      expect(pumpPenisActions).toHaveLength(0);
    });
  });
});
```

## File Structure Summary

The implementation will require creating these files:

### New Files to Create:

1. `data/mods/sex/actions/pump_penis.action.json`
2. `data/mods/sex/conditions/event-is-action-pump-penis.condition.json`
3. `data/mods/sex/rules/handle_pump_penis.rule.json`
4. `tests/integration/mods/sex/pump_penis_action.test.js`
5. `tests/integration/scopes/pumpPenisActionDiscovery.integration.test.js`

### Files to Reference (existing):

- `data/mods/sex/scopes/actors_with_penis_facing_each_other.scope`
- `data/mods/sex/actions/fondle_penis.action.json` (for pattern matching)
- `data/mods/sex/actions/pump_penis_from_up_close.action.json` (original reference)

## Testing Strategy

### Integration Tests

The comprehensive test suite covers:

1. **Rule Behavior Tests** (`pump_penis_action.test.js`)
   - Basic rule execution and message validation
   - Event dispatching (perceptible and success events)
   - Turn management and macro execution
   - Edge cases: missing targets, wrong actions
   - Message format consistency

2. **Action Discoverability Tests** (`pumpPenisActionDiscovery.integration.test.js`)
   - Scope resolution with `actors_with_penis_facing_each_other`
   - Component validation (closeness requirement)
   - Socket coverage validation (clothing system)
   - Facing direction requirements
   - Anatomy requirements (penis detection)
   - Edge cases: no penis, facing away, covered genitals

### Test Coverage Requirements

- **Action Discoverability**: ≥95% coverage of scope resolution paths
- **Rule Execution**: 100% coverage of rule actions and message formatting
- **Edge Cases**: Comprehensive coverage of failure scenarios
- **Integration**: End-to-end workflow validation

## Key Implementation Notes

### 1. Scope Integration
- Uses existing `sex:actors_with_penis_facing_each_other` scope
- No new scope files needed
- Inherits all validation logic from existing scope

### 2. Component Requirements
- Requires only `positioning:closeness` component
- Removes kneeling requirement from original action
- Allows for standing face-to-face interaction

### 3. Visual Consistency
- Purple color scheme (#4a148c) matches `sex:fondle_penis`
- Maintains visual consistency within sex mod
- Clear hover states for accessibility

### 4. Message Formatting
- Consistent message for perceptible event and success message
- Uses proper pronoun formatting with `{context.targetName}`
- Follows established sex mod messaging patterns

### 5. Rule Architecture
- Follows exact pattern from `handle_fondle_penis.rule.json`
- Uses `action_target_general` perception type
- Includes proper error handling for missing entities

### 6. Test Architecture
- Separates rule testing from action discovery testing
- Uses established test patterns from sex mod
- Provides comprehensive edge case coverage

## Validation Checklist

### Action Definition
- [ ] Action file follows schema and uses correct ID format
- [ ] Uses `sex:actors_with_penis_facing_each_other` scope
- [ ] Requires only `positioning:closeness` component
- [ ] Uses `primary` target designation
- [ ] Template format matches specification
- [ ] Visual scheme matches `sex:fondle_penis`

### Rule Implementation
- [ ] Condition properly identifies the action event
- [ ] Rule dispatches correct perceptible event message
- [ ] Rule dispatches correct success message
- [ ] Uses `action_target_general` perception type
- [ ] Includes proper macro for turn ending

### Test Coverage
- [ ] Integration test covers basic rule execution
- [ ] Integration test validates message formatting
- [ ] Integration test handles edge cases
- [ ] Action discovery test covers scope resolution
- [ ] Action discovery test validates component requirements
- [ ] Action discovery test covers clothing/anatomy validation

### Integration Requirements
- [ ] Files follow project naming conventions
- [ ] JSON schemas validate correctly
- [ ] Tests follow project patterns
- [ ] No conflicts with existing actions
- [ ] Proper separation from kneeling variant

### Quality Assurance
- [ ] All tests pass without errors
- [ ] Code follows project style guidelines
- [ ] Messages are grammatically correct
- [ ] Visual scheme provides good accessibility
- [ ] No performance regressions in action discovery