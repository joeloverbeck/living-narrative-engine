/**
 * @file Regression tests for perceptible event validation
 * @description Ensures all rules generate valid perceptible events that conform to the schema
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { Glob } from 'glob';
import perceptibleEventSchema from '../../../data/mods/core/events/perceptible_event.event.json';
import dispatchPerceptibleEventOperationSchema from '../../../data/schemas/operations/dispatchPerceptibleEvent.schema.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';

const traverseActions = (actions, callback) => {
  if (!Array.isArray(actions)) {
    return;
  }

  const stack = [...actions];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }

    if (node.type) {
      callback(node);
    }

    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === 'object') {
            stack.push(item);
          }
        });
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    });
  }
};

let perceptionTypeEnum = [];

describe('Perceptible Event Validation Regression Tests', () => {
  let ajv;
  let validatePerceptibleEvent;
  let allRules;

  beforeAll(async () => {
    // Set up AJV validator
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Add common schema for reference resolution
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    ajv.addSchema(commonSchema, commonSchema.$id);
    perceptionTypeEnum = commonSchema.definitions?.perceptionType?.enum ?? [];

    validatePerceptibleEvent = ajv.compile(
      perceptibleEventSchema.payloadSchema
    );

    // Load all rules
    const glob = new Glob('data/mods/**/rules/*.rule.json', {
      cwd: process.cwd(),
    });
    const ruleFiles = await Array.fromAsync(glob);
    allRules = ruleFiles
      .map((file) => {
        try {
          return {
            file,
            rule: JSON.parse(fs.readFileSync(file, 'utf-8')),
          };
        } catch (e) {
          console.warn(`Failed to load rule ${file}: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
  });

  it('validates all perception types used in rules are valid', () => {
    const validPerceptionTypes = perceptionTypeEnum;
    const usedPerceptionTypes = new Set();

    // Extract perception types from rules
    allRules.forEach(({ rule }) => {
      traverseActions(rule.actions, (action) => {
        if (
          action.type === 'SET_VARIABLE' &&
          action.parameters?.variable_name === 'perceptionType'
        ) {
          usedPerceptionTypes.add(action.parameters.value);
        }

        if (action.type === 'DISPATCH_PERCEPTIBLE_EVENT') {
          const operationType = action.parameters?.perception_type;
          if (operationType) {
            usedPerceptionTypes.add(operationType);
          }
        }
      });
    });

    // Check if any used types are invalid
    // Exclude template variables like {context.perceptionType} which are resolved at runtime
    const invalidTypes = [...usedPerceptionTypes].filter(
      (type) =>
        !validPerceptionTypes.includes(type) && !type.startsWith('{context.')
    );

    if (invalidTypes.length > 0) {
      console.log('Valid perception types:', validPerceptionTypes);
      console.log('Invalid perception types found:', invalidTypes);
    }

    expect(invalidTypes).toHaveLength(0);
  });

  it('allows all perception types defined by the operation schema', () => {
    expect(perceptionTypeEnum.length).toBeGreaterThan(0);

    const eventPerceptionTypes = new Set(perceptionTypeEnum);
    const operationPerceptionTypes = perceptionTypeEnum;

    const missingInEventSchema = operationPerceptionTypes.filter(
      (type) => !eventPerceptionTypes.has(type)
    );
    expect(missingInEventSchema).toHaveLength(0);

    const eventSchemaRef =
      perceptibleEventSchema.payloadSchema.properties.perceptionType.allOf?.find(
        (schema) => schema.$ref
      )?.$ref;
    const operationSchemaRef =
      dispatchPerceptibleEventOperationSchema.$defs.Parameters.properties.perception_type.allOf?.find(
        (schema) => schema.$ref
      )?.$ref;

    expect(eventSchemaRef).toBe(
      'schema://living-narrative-engine/common.schema.json#/definitions/perceptionType'
    );
    expect(operationSchemaRef).toBe(
      '../common.schema.json#/definitions/perceptionType'
    );
  });

  it('validates targetId values follow correct patterns', () => {
    const problematicRules = [];

    allRules.forEach(({ file, rule }) => {
      const actions = rule.actions || [];
      actions.forEach((action, index) => {
        if (
          action.type === 'SET_VARIABLE' &&
          action.parameters?.variable_name === 'targetId' &&
          action.parameters?.value === 'none'
        ) {
          problematicRules.push({
            file: path.basename(file),
            ruleId: rule.rule_id,
            actionIndex: index,
            value: action.parameters.value,
          });
        }
      });
    });

    if (problematicRules.length > 0) {
      console.log('Rules using string "none" for targetId:', problematicRules);
    }

    // Should use null instead of string "none"
    expect(problematicRules).toHaveLength(0);
  });

  it('validates stand_up rule uses correct perception type and target', () => {
    const standUpRule = allRules.find(({ file }) =>
      file.includes('stand_up.rule.json')
    );
    expect(standUpRule).toBeDefined();

    const { rule } = standUpRule;
    const actions = rule.actions || [];

    // Find perception type setting
    const perceptionTypeAction = actions.find(
      (action) =>
        action.type === 'SET_VARIABLE' &&
        action.parameters?.variable_name === 'perceptionType'
    );
    expect(perceptionTypeAction).toBeDefined();
    expect(perceptionTypeAction.parameters.value).toBe('physical.self_action');

    // Find target ID setting
    const targetIdAction = actions.find(
      (action) =>
        action.type === 'SET_VARIABLE' &&
        action.parameters?.variable_name === 'targetId'
    );
    expect(targetIdAction).toBeDefined();
    expect(targetIdAction.parameters.value).toBe(null);
  });

  it('validates kneel_before rule uses correct perception type', () => {
    const kneelBeforeRule = allRules.find(({ file }) =>
      file.includes('kneel_before.rule.json')
    );
    expect(kneelBeforeRule).toBeDefined();

    const { rule } = kneelBeforeRule;
    const actions = rule.actions || [];

    // Find perception type setting
    const perceptionTypeAction = actions.find(
      (action) =>
        action.type === 'SET_VARIABLE' &&
        action.parameters?.variable_name === 'perceptionType'
    );
    expect(perceptionTypeAction).toBeDefined();
    expect(perceptionTypeAction.parameters.value).toBe('physical.target_action');
  });

  it('demonstrates valid perceptible event payloads', () => {
    // Test self-action (no target)
    const selfActionPayload = {
      eventName: 'core:perceptible_event',
      locationId: 'test:location',
      descriptionText: 'Actor performs a self action',
      timestamp: new Date().toISOString(),
      perceptionType: 'physical.self_action',
      actorId: 'test:actor',
      targetId: null,
      involvedEntities: [],
      contextualData: {},
    };

    expect(validatePerceptibleEvent(selfActionPayload)).toBe(true);

    // Test target action
    const targetActionPayload = {
      eventName: 'core:perceptible_event',
      locationId: 'test:location',
      descriptionText: 'Actor performs action on target',
      timestamp: new Date().toISOString(),
      perceptionType: 'physical.target_action',
      actorId: 'test:actor',
      targetId: 'test:target',
      involvedEntities: [],
      contextualData: {},
    };

    expect(validatePerceptibleEvent(targetActionPayload)).toBe(true);
  });

  it('validates macro generates valid perceptible event structure', () => {
    // Test that the logSuccessAndEndTurn macro creates properly structured perceptible events
    const macroActions = logSuccessMacro.actions;

    // Find the DISPATCH_EVENT action that creates perceptible events
    const dispatchAction = macroActions.find(
      (action) =>
        action.type === 'DISPATCH_EVENT' &&
        action.parameters.eventType === 'core:perceptible_event'
    );

    expect(dispatchAction).toBeDefined();
    expect(dispatchAction.parameters.payload).toBeDefined();

    const payload = dispatchAction.parameters.payload;

    // Verify required fields are present in template
    expect(payload.eventName).toBe('core:perceptible_event');
    expect(payload.locationId).toBe('{context.locationId}');
    expect(payload.descriptionText).toBe('{context.logMessage}');
    expect(payload.perceptionType).toBe('{context.perceptionType}');
    expect(payload.actorId).toBe('{event.payload.actorId}');
    expect(payload.targetId).toBe('{context.targetId}');
  });
});
