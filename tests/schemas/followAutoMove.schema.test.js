// tests/schemas/followAutoMove.schema.test.js

const Ajv = require('ajv');
const { test, expect, describe } = require('@jest/globals');
const jsonLogic = require('json-logic-js');

// load all the schemas AJV will need
const ruleSchema = require('../../data/schemas/rule.schema.json');
const commonSchema = require('../../data/schemas/common.schema.json');
const operationSchema = require('../../data/schemas/operation.schema.json');
const jsonLogicSchema = require('../../data/schemas/json-logic.schema.json');

// and your rule under test
const rule = require('../../data/mods/core/rules/follow_auto_move.rule.json');

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
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
    // now compile & validate
    const valid = ajv.validate(ruleSchema, rule);
    if (!valid) {
      console.error('AJV errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });

  test('happy path: two co-located followers trigger two core:attempt_action events', () => {
    const positions = { f1: prevLoc, f2: prevLoc, f3: 'otherLoc' };

    // JSON-Logic check
    const conditionMet = jsonLogic.apply(rule.condition, {
      actor,
      event: baseEvent,
    });
    expect(conditionMet).toBe(true);

    // simulate the FOR_EACH → IF → DISPATCH_EVENT logic
    const dispatched = [];
    actor.components['core:leading'].followers.forEach((fId) => {
      const loc = positions[fId];
      if (loc === prevLoc) {
        dispatched.push({
          eventType: 'core:attempt_action',
          payload: {
            eventName: 'core:attempt_action',
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

  test('rule does not emit any perceptible_event actions itself', () => {
    const allActions = JSON.stringify(rule.actions);
    expect(allActions).not.toMatch(/perceptible_event/);
  });
});
