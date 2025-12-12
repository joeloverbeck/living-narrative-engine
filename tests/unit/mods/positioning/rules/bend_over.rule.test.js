/**
 * @file Unit tests for the positioning:bend_over rule
 * @description Tests the rule structure, logic, and expected behavior according to BENOVERSYS-005 workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  createRuleTestEnvironment,
  validateRuleStructure,
} from '../../../../common/rules/ruleTestUtilities.js';

describe('positioning:bend_over rule', () => {
  let rule;
  let testEnv;

  beforeEach(() => {
    // Load the rule file
    const rulePath = path.resolve(
      process.cwd(),
      'data/mods/positioning/rules/bend_over.rule.json'
    );
    const ruleContent = fs.readFileSync(rulePath, 'utf8');
    rule = JSON.parse(ruleContent);

    // Create test environment
    testEnv = createRuleTestEnvironment({
      entities: [],
      rules: [rule],
      conditions: {
        'positioning:event-is-action-bend-over': {
          id: 'positioning:event-is-action-bend-over',
          logic: {
            '==': [{ var: 'event.payload.actionId' }, 'positioning:bend_over'],
          },
        },
      },
      macros: {
        'core:logSuccessAndEndTurn': {
          id: 'core:logSuccessAndEndTurn',
          actions: [
            {
              type: 'DISPATCH_EVENT',
              parameters: {
                event_type: 'core:perceptible_event',
                payload: {
                  locationId: '{context.locationId}',
                  perceptionType: '{context.perceptionType}',
                  message: '{context.logMessage}',
                  actorId: '{event.payload.actorId}',
                  targetId: '{context.targetId}',
                },
              },
            },
            {
              type: 'DISPATCH_EVENT',
              parameters: {
                event_type: 'core:turn_ended',
                payload: {
                  entityId: '{event.payload.actorId}',
                },
              },
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  describe('rule structure validation', () => {
    it('should have correct rule_id', () => {
      expect(rule.rule_id).toBe('handle_bend_over');
    });

    it('should have comment field explaining purpose', () => {
      expect(rule.comment).toBeDefined();
      expect(typeof rule.comment).toBe('string');
      expect(rule.comment).toContain('positioning:bend_over');
      expect(rule.comment).toContain('bending_over component');
    });

    it('should have correct event_type', () => {
      expect(rule.event_type).toBe('core:attempt_action');
    });

    it('should reference positioning:event-is-action-bend-over condition', () => {
      expect(rule.condition).toBeDefined();
      expect(rule.condition.condition_ref).toBe(
        'positioning:event-is-action-bend-over'
      );
    });

    it('should have actions array with expected structure', () => {
      expect(Array.isArray(rule.actions)).toBe(true);
      expect(rule.actions.length).toBe(12); // 10 actions + 1 macro + 1 actor/target refresh
    });

    it('should have correct JSON schema reference', () => {
      expect(rule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });

    it('should pass rule structure validation', () => {
      const validation = validateRuleStructure(rule);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.structure.hasEventType).toBe(true);
      expect(validation.structure.hasCondition).toBe(true);
      expect(validation.structure.hasActions).toBe(true);
    });
  });

  describe('action sequence validation', () => {
    it('should start with GET_NAME action for actor', () => {
      const firstAction = rule.actions[0];
      expect(firstAction.type).toBe('GET_NAME');
      expect(firstAction.parameters.entity_ref).toBe('actor');
      expect(firstAction.parameters.result_variable).toBe('actorName');
    });

    it('should query actor position component', () => {
      const positionAction = rule.actions[1];
      expect(positionAction.type).toBe('QUERY_COMPONENT');
      expect(positionAction.parameters.entity_ref).toBe('actor');
      expect(positionAction.parameters.component_type).toBe('core:position');
      expect(positionAction.parameters.result_variable).toBe('actorPosition');
    });

    it('should get target surface name', () => {
      const surfaceAction = rule.actions[2];
      expect(surfaceAction.type).toBe('GET_NAME');
      expect(surfaceAction.parameters.entity_ref).toBe('target');
      expect(surfaceAction.parameters.result_variable).toBe('surfaceName');
    });

    it('should add bending_over component with surface reference', () => {
      const componentAction = rule.actions[3];
      expect(componentAction.type).toBe('ADD_COMPONENT');
      expect(componentAction.parameters.entity_ref).toBe('actor');
      expect(componentAction.parameters.component_type).toBe(
        'positioning:bending_over'
      );
      expect(componentAction.parameters.value.surface_id).toBe(
        '{event.payload.targetId}'
      );
    });

    it('should lock movement while bending over', () => {
      const lockAction = rule.actions[4];
      expect(lockAction.type).toBe('LOCK_MOVEMENT');
      expect(lockAction.parameters.actor_id).toBe('{event.payload.actorId}');
    });

    it('should set up log message with string template', () => {
      const logAction = rule.actions[7];
      expect(logAction.type).toBe('SET_VARIABLE');
      expect(logAction.parameters.variable_name).toBe('logMessage');
      expect(logAction.parameters.value).toBe(
        '{context.actorName} bends over {context.surfaceName}.'
      );
    });

    it('should set perception type for action feedback', () => {
      const perceptionAction = rule.actions[8];
      expect(perceptionAction.type).toBe('SET_VARIABLE');
      expect(perceptionAction.parameters.variable_name).toBe('perceptionType');
      expect(perceptionAction.parameters.value).toBe('physical.self_action');
    });

    it('should capture location ID from actor position', () => {
      const locationAction = rule.actions[9];
      expect(locationAction.type).toBe('SET_VARIABLE');
      expect(locationAction.parameters.variable_name).toBe('locationId');
      expect(locationAction.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('should capture target ID from event payload', () => {
      const targetAction = rule.actions[10];
      expect(targetAction.type).toBe('SET_VARIABLE');
      expect(targetAction.parameters.variable_name).toBe('targetId');
      expect(targetAction.parameters.value).toBe('{event.payload.targetId}');
    });

    it('should end with core:logSuccessAndEndTurn macro', () => {
      const macroAction = rule.actions[11];
      expect(macroAction.macro).toBe('core:logSuccessAndEndTurn');
    });
  });

  describe('rule condition behavior', () => {
    it('should only trigger for bend_over actions', () => {
      const condition = testEnv.dataRegistry.getConditionDefinition(
        'positioning:event-is-action-bend-over'
      );
      expect(condition).toBeDefined();
      expect(condition.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        'positioning:bend_over',
      ]);
    });

    it('should evaluate condition correctly for bend_over action', async () => {
      const testEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:bend_over',
          actorId: 'test:actor',
          targetId: 'test:surface',
        },
      };

      const result = await testEnv.jsonLogic.evaluate(
        testEnv.dataRegistry.getConditionDefinition(
          'positioning:event-is-action-bend-over'
        ).logic,
        { event: testEvent }
      );

      expect(result).toBe(true);
    });

    it('should not trigger for different actions', async () => {
      const testEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:sit_down',
          actorId: 'test:actor',
          targetId: 'test:furniture',
        },
      };

      const result = await testEnv.jsonLogic.evaluate(
        testEnv.dataRegistry.getConditionDefinition(
          'positioning:event-is-action-bend-over'
        ).logic,
        { event: testEvent }
      );

      expect(result).toBe(false);
    });
  });

  describe('string template resolution', () => {
    it('should define correct string templates for dynamic values', () => {
      // Verify templates exist in actions
      const componentAction = rule.actions[3];
      expect(componentAction.parameters.value.surface_id).toBe(
        '{event.payload.targetId}'
      );

      const logAction = rule.actions[7];
      expect(logAction.parameters.value).toBe(
        '{context.actorName} bends over {context.surfaceName}.'
      );

      const lockAction = rule.actions[4];
      expect(lockAction.parameters.actor_id).toBe('{event.payload.actorId}');

      const locationAction = rule.actions[9];
      expect(locationAction.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );

      const targetAction = rule.actions[10];
      expect(targetAction.parameters.value).toBe('{event.payload.targetId}');
    });

    it('should have valid template syntax', () => {
      const templates = [
        '{event.payload.targetId}',
        '{event.payload.actorId}',
        '{context.actorName}',
        '{context.surfaceName}',
        '{context.actorPosition.locationId}',
      ];

      templates.forEach((template) => {
        expect(template).toMatch(/^\{[a-zA-Z][a-zA-Z0-9_.]*\}$/);
      });
    });
  });

  describe('entity reference handling', () => {
    it('should correctly reference actor entity', () => {
      const actorReferences = rule.actions.filter(
        (action) => action.parameters?.entity_ref === 'actor'
      );

      expect(actorReferences).toHaveLength(4); // GET_NAME, QUERY_COMPONENT, ADD_COMPONENT, REGENERATE_DESCRIPTION

      actorReferences.forEach((action) => {
        expect([
          'GET_NAME',
          'QUERY_COMPONENT',
          'ADD_COMPONENT',
          'REGENERATE_DESCRIPTION',
        ]).toContain(action.type);
      });
    });

    it('should correctly reference target entity', () => {
      const targetReferences = rule.actions.filter(
        (action) => action.parameters?.entity_ref === 'target'
      );

      expect(targetReferences).toHaveLength(2); // GET_NAME for surface + REGENERATE_DESCRIPTION refresh
      expect(targetReferences[0].type).toBe('GET_NAME');
      expect(targetReferences[0].parameters.result_variable).toBe(
        'surfaceName'
      );
      expect(targetReferences[1].type).toBe('REGENERATE_DESCRIPTION');
    });
  });

  describe('macro integration', () => {
    it('should use core:logSuccessAndEndTurn macro', () => {
      const macroAction = rule.actions[rule.actions.length - 1];
      expect(macroAction.macro).toBe('core:logSuccessAndEndTurn');
    });

    it('should have macro definition available in test environment', () => {
      const macro = testEnv.dataRegistry.getMacroDefinition(
        'core:logSuccessAndEndTurn'
      );
      expect(macro).toBeDefined();
      expect(macro.actions).toBeDefined();
      expect(Array.isArray(macro.actions)).toBe(true);
    });
  });

  describe('positioning component integration', () => {
    it('should add bending_over component with required structure', () => {
      const componentAction = rule.actions.find(
        (action) => action.type === 'ADD_COMPONENT'
      );

      expect(componentAction.parameters.component_type).toBe(
        'positioning:bending_over'
      );
      expect(componentAction.parameters.value).toHaveProperty('surface_id');
      expect(typeof componentAction.parameters.value.surface_id).toBe('string');
    });

    it('should query core:position component correctly', () => {
      const queryAction = rule.actions.find(
        (action) => action.type === 'QUERY_COMPONENT'
      );

      expect(queryAction.parameters.component_type).toBe('core:position');
      expect(queryAction.parameters.result_variable).toBe('actorPosition');
    });
  });

  describe('logging and feedback', () => {
    it('should prepare appropriate log message', () => {
      const logAction = rule.actions.find(
        (action) => action.parameters?.variable_name === 'logMessage'
      );

      expect(logAction.parameters.value).toContain('{context.actorName}');
      expect(logAction.parameters.value).toContain('{context.surfaceName}');
      expect(logAction.parameters.value).toContain('bends over');
    });

    it('should set correct perception type', () => {
      const perceptionAction = rule.actions.find(
        (action) => action.parameters?.variable_name === 'perceptionType'
      );

      expect(perceptionAction.parameters.value).toBe('physical.self_action');
    });

    it('should capture required context variables for logging', () => {
      const contextVariables = rule.actions
        .filter((action) => action.type === 'SET_VARIABLE')
        .map((action) => action.parameters.variable_name);

      expect(contextVariables).toContain('logMessage');
      expect(contextVariables).toContain('perceptionType');
      expect(contextVariables).toContain('locationId');
      expect(contextVariables).toContain('targetId');
    });
  });
});
