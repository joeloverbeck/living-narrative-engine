/**
 * @file Integration tests for turn_started.rule.json.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import Ajv from 'ajv';
import ruleSchema from '../../../data/schemas/rule.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionSchema from '../../../data/schemas/condition.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../unit/helpers/loadConditionSchemas.js';
import turnStartedRule from '../../../data/mods/core/rules/turn_started.rule.json';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

describe('turn_started rule integration', () => {
  let testEnv;
  let events = [];

  beforeEach(() => {
    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([turnStartedRule]),
      getConditionDefinition: jest.fn().mockReturnValue(undefined),
    };

    // Create handlers with dependencies
    const createHandlers = (entityManager, eventBus, logger) => {
      return {
        ADD_COMPONENT: new AddComponentHandler({
          entityManager,
          logger,
          safeEventDispatcher: {
            dispatch: (...args) => eventBus.dispatch(...args),
          },
        }),
      };
    };

    // Create test environment
    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [turnStartedRule],
      dataRegistry,
    });

    // Set up event listener
    events = [];
    testEnv.eventBus.subscribe('*', (event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('validates turn_started.rule.json against schema', () => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    loadOperationSchemas(ajv);
    loadConditionSchemas(ajv);
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    const valid = ajv.validate(ruleSchema, turnStartedRule);
    if (!valid) console.error(ajv.errors);
    expect(valid).toBe(true);
  });

  it('adds current_actor component to the payload entity', async () => {
    testEnv.reset([
      {
        id: 'player1',
        components: {},
      },
    ]);

    await testEnv.eventBus.dispatch('core:turn_started', {
      entityId: 'player1',
    });

    expect(
      testEnv.entityManager.getComponentData(
        'player1',
        CURRENT_ACTOR_COMPONENT_ID
      )
    ).toEqual({});
  });

  it('replaces existing current_actor component', async () => {
    testEnv.reset([
      {
        id: 'player1',
        components: {
          [CURRENT_ACTOR_COMPONENT_ID]: { actorId: 'oldActor' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch('core:turn_started', {
      entityId: 'player1',
    });

    expect(
      testEnv.entityManager.getComponentData(
        'player1',
        CURRENT_ACTOR_COMPONENT_ID
      )
    ).toEqual({});
  });
});
