/**
 * @file Integration test for handle_wield_threateningly rule validation
 * Ensures the rule follows the standard pattern with context setup and macro usage
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('Wield Threateningly Rule - Validation', () => {
  let ruleFile;

  beforeEach(async () => {
    // Load the rule file directly
    const rulePath = resolve('data/mods/weapons/rules/handle_wield_threateningly.rule.json');
    const content = await fs.readFile(rulePath, 'utf8');
    ruleFile = JSON.parse(content);
  });

  afterEach(() => {
    ruleFile = null;
  });

  it('should follow standard rule pattern with context setup operations', () => {
    // Assert: Rule should exist and be properly structured
    expect(ruleFile).toBeDefined();
    expect(ruleFile.rule_id).toBe('handle_wield_threateningly');
    expect(ruleFile.actions).toHaveLength(11);

    // Assert: First two operations should get names
    expect(ruleFile.actions[0].type).toBe('GET_NAME');
    expect(ruleFile.actions[0].parameters.entity_ref).toBe('actor');
    expect(ruleFile.actions[0].parameters.result_variable).toBe('actorName');

    expect(ruleFile.actions[1].type).toBe('GET_NAME');
    expect(ruleFile.actions[1].parameters.entity_ref).toBe('target');
    expect(ruleFile.actions[1].parameters.result_variable).toBe('targetName');

    // Assert: Third operation queries position for locationId
    expect(ruleFile.actions[2].type).toBe('QUERY_COMPONENT');
    expect(ruleFile.actions[2].parameters.component_type).toBe('core:position');
    expect(ruleFile.actions[2].parameters.result_variable).toBe('actorPosition');
  });

  it('should set required context variables for logSuccessAndEndTurn macro', () => {
    // Assert: logMessage is set
    const logMessageAction = ruleFile.actions.find(
      (action) => action.type === 'SET_VARIABLE' && action.parameters.variable_name === 'logMessage'
    );
    expect(logMessageAction).toBeDefined();
    expect(logMessageAction.parameters.value).toContain('{context.actorName}');
    expect(logMessageAction.parameters.value).toContain('{context.targetName}');

    // Assert: perceptionType is set
    const perceptionTypeAction = ruleFile.actions.find(
      (action) =>
        action.type === 'SET_VARIABLE' && action.parameters.variable_name === 'perceptionType'
    );
    expect(perceptionTypeAction).toBeDefined();
    expect(perceptionTypeAction.parameters.value).toBe('action_target_general');

    // Assert: locationId is set
    const locationIdAction = ruleFile.actions.find(
      (action) => action.type === 'SET_VARIABLE' && action.parameters.variable_name === 'locationId'
    );
    expect(locationIdAction).toBeDefined();
    expect(locationIdAction.parameters.value).toBe('{context.actorPosition.locationId}');

    // Assert: targetId is set
    const targetIdAction = ruleFile.actions.find(
      (action) => action.type === 'SET_VARIABLE' && action.parameters.variable_name === 'targetId'
    );
    expect(targetIdAction).toBeDefined();
    expect(targetIdAction.parameters.value).toBe('{event.payload.targetId}');
  });

  it('should include macro for ending turn as final action', () => {
    // Assert: Last action should be the macro
    const lastAction = ruleFile.actions[ruleFile.actions.length - 1];
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
    expect(lastAction.comment).toContain('turn');
  });
});
