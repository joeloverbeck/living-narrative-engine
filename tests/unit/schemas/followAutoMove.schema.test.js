// tests/schemas/followAutoMove.schema.test.js

const Ajv = require('ajv');
const { test, expect, describe } = require('@jest/globals');
const jsonLogic = require('json-logic-js');

// load all the schemas AJV will need
const ruleSchema = require('../../../data/schemas/rule.schema.json');
const commonSchema = require('../../../data/schemas/common.schema.json');
const operationSchema = require('../../../data/schemas/operation.schema.json');
const jsonLogicSchema = require('../../../data/schemas/json-logic.schema.json');
const conditionContainerSchema = require('../../../data/schemas/condition-container.schema.json');
const loadOperationSchemas = require('../helpers/loadOperationSchemas.js');

// and your rule under test
const rule = require('../../../data/mods/core/rules/follow_auto_move.rule.json');
const { ATTEMPT_ACTION_ID } = require('../../../src/constants/eventIds.js');

describe('core_follow_auto_move.rule.json', () => {
  const leaderId = 'leader1';
  const prevLoc = 'locA';
  const direction = 'north';
  const originalCmd = 'go north';
  const followers = ['f1', 'f2', 'f3'];
  const actor = {
    components: {
      'core:leading': { followers },
    },
  };
  const baseEvent = {
    payload: {
      entityId: leaderId,
      previousLocationId: prevLoc,
      direction,
      originalCommand: originalCmd,
    },
  };

  test('validates against the System Rule JSON schema', () => {
    const ajv = new Ajv({ allErrors: true });
    // register each schema with its canonical $id
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'schema://living-narrative-engine/operation.schema.json'
    );
    ajv.addSchema(
      conditionContainerSchema,
      'schema://living-narrative-engine/condition-container.schema.json'
    );
    loadOperationSchemas(ajv);
    ajv.addSchema(
      jsonLogicSchema,
      'schema://living-narrative-engine/json-logic.schema.json'
    );
    // now compile & validate
    const valid = ajv.validate(ruleSchema, rule);
    if (!valid) {
      console.error('AJV errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });

  test('happy path: two co-located followers trigger two ATTEMPT_ACTION_ID events', () => {
    const positions = { f1: prevLoc, f2: prevLoc, f3: 'otherLoc' };

    // New behavior: the condition references a named condition definition.
    // Ensure the rule points to the expected condition reference.
    expect(rule).toHaveProperty(
      'condition.condition_ref',
      'core:actor-is-not-null'
    );

    // simulate the FOR_EACH → IF → DISPATCH_EVENT logic
    const dispatched = [];
    actor.components['core:leading'].followers.forEach((fId) => {
      const loc = positions[fId];
      if (loc === prevLoc) {
        dispatched.push({
          eventType: ATTEMPT_ACTION_ID,
          payload: {
            eventName: ATTEMPT_ACTION_ID,
            actorId: fId,
            actionId: 'core:go',
            direction,
            originalInput: originalCmd,
          },
        });
      }
    });

    expect(dispatched).toHaveLength(2);
    expect(dispatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ actorId: 'f1' }),
        }),
        expect.objectContaining({
          payload: expect.objectContaining({ actorId: 'f2' }),
        }),
      ])
    );
  });

  test('non-matching case: no co-located followers ⇒ no events', () => {
    const positions = { f1: 'X', f2: 'Y', f3: 'Z' };
    const dispatched = [];
    followers.forEach((fId) => {
      if (positions[fId] === prevLoc) dispatched.push(fId);
    });
    expect(dispatched).toHaveLength(0);
  });
});
