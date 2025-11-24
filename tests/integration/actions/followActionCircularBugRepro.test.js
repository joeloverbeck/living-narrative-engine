/**
 * @file Minimal reproduction test for the circular following bug
 * This test recreates the exact scenario from the error logs to debug why
 * Amaia can follow Iker even though Iker is already following her.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Follow Action Circular Bug - Minimal Reproduction', () => {
  let logger;
  let jsonLogicService;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: null, // Not needed for this test
    });
  });

  it('reproduces the exact error scenario from logs', () => {
    // Recreate the exact data structure from the error logs
    const actor = {
      id: 'p_erotica:amaia_castillo_instance',
      components: {
        [LEADING_COMPONENT_ID]: {
          followers: ['p_erotica:iker_aguirre_instance'],
        },
      },
    };

    const entity = {
      id: 'p_erotica:iker_aguirre_instance',
      components: {
        [FOLLOWING_COMPONENT_ID]: {
          leaderId: 'p_erotica:amaia_castillo_instance',
        },
      },
    };

    const location = {
      id: 'p_erotica:outside_tables_coffee_shop_instance',
    };

    // Create the evaluation context
    const context = {
      actor,
      entity,
      location,
    };

    console.log('\n=== Test Data ===');
    console.log('Actor (Amaia):', JSON.stringify(actor, null, 2));
    console.log('Entity (Iker):', JSON.stringify(entity, null, 2));
    console.log('');

    // Test the exact condition from the logs:
    // { "not": { "in": [{ "var": "entity.id" }, { "var": "actor.components.companionship:leading.followers" }] } }
    const condition = {
      not: {
        in: [
          { var: 'entity.id' },
          { var: `actor.components.${LEADING_COMPONENT_ID}.followers` },
        ],
      },
    };

    console.log('=== Evaluating Condition ===');
    console.log('Condition:', JSON.stringify(condition, null, 2));
    console.log('');

    // Evaluate the condition
    const result = jsonLogicService.evaluate(condition, context);

    console.log('=== Result ===');
    console.log('Evaluation result:', result);
    console.log('');

    // The condition should evaluate to FALSE because:
    // - entity.id = 'p_erotica:iker_aguirre_instance'
    // - actor.components.companionship:leading.followers = ['p_erotica:iker_aguirre_instance']
    // - entity.id IS in the followers array
    // - So "in" should return true
    // - And "not" should return false
    expect(result).toBe(false);

    // Test individual parts to understand the issue
    console.log('=== Testing Individual Parts ===');

    // Test 1: Can we resolve entity.id?
    const entityIdCondition = { var: 'entity.id' };
    const entityIdResult = jsonLogicService.evaluate(
      entityIdCondition,
      context
    );
    console.log('entity.id resolves to:', entityIdResult);
    expect(entityIdResult).toBe('p_erotica:iker_aguirre_instance');

    // Test 2: Can we resolve the followers array?
    const followersCondition = {
      var: `actor.components.${LEADING_COMPONENT_ID}.followers`,
    };
    const followersResult = jsonLogicService.evaluate(
      followersCondition,
      context
    );
    console.log('followers array resolves to:', followersResult);
    expect(followersResult).toEqual(['p_erotica:iker_aguirre_instance']);

    // Test 3: Direct "in" test
    const inCondition = {
      in: [
        'p_erotica:iker_aguirre_instance',
        ['p_erotica:iker_aguirre_instance'],
      ],
    };
    const inResult = jsonLogicService.evaluate(inCondition, context);
    console.log('Direct "in" test result:', inResult);
    expect(inResult).toBe(true);
  });

  it('tests the in operator with various data types', () => {
    console.log('\n=== Testing "in" operator behavior ===');

    // Test 1: String in array
    const test1 = jsonLogicService.evaluate(
      { in: ['test', ['test', 'other']] },
      {}
    );
    console.log('String in array:', test1);
    expect(test1).toBe(true);

    // Test 2: String not in array
    const test2 = jsonLogicService.evaluate(
      { in: ['test', ['other', 'values']] },
      {}
    );
    console.log('String not in array:', test2);
    expect(test2).toBe(false);

    // Test 3: String in null/undefined
    const test3 = jsonLogicService.evaluate({ in: ['test', null] }, {});
    console.log('String in null:', test3);
    expect(test3).toBe(false);

    const test4 = jsonLogicService.evaluate({ in: ['test', undefined] }, {});
    console.log('String in undefined:', test4);
    expect(test4).toBe(false);

    // Test 5: Complex ID matching
    const complexId = 'p_erotica:iker_aguirre_instance';
    const test5 = jsonLogicService.evaluate(
      { in: [complexId, [complexId]] },
      {}
    );
    console.log('Complex ID in array:', test5);
    expect(test5).toBe(true);
  });

  it('tests variable resolution with nested paths', async () => {
    console.log('\n=== Testing variable resolution ===');

    const context = {
      actor: {
        components: {
          'core:leading': {
            followers: ['follower1', 'follower2'],
          },
        },
      },
    };

    // Test nested path resolution
    const followersPath = jsonLogicService.evaluate(
      { var: 'actor.components.core:leading.followers' },
      context
    );
    console.log('Resolved followers:', followersPath);

    // This should return the actual array, not just true/false
    // The jsonLogic evaluate method converts to boolean, so let's use json-logic directly
    const jsonLogic = await import('json-logic-js');
    const actualFollowers = jsonLogic.default.apply(
      { var: 'actor.components.core:leading.followers' },
      context
    );
    console.log('Actual followers array:', actualFollowers);
    expect(Array.isArray(actualFollowers)).toBe(true);
    expect(actualFollowers).toEqual(['follower1', 'follower2']);
  });
});
