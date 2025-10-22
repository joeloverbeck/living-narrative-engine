/**
 * @file Regression test for BREAK_CLOSENESS_WITH_TARGET schema validation error
 * Ensures the BREAK_CLOSENESS_WITH_TARGET operation is fully registered across
 * schema, interpreter, and rule usage so validation succeeds.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { performPreValidation } from '../../../src/utils/preValidationUtils.js';

/**
 * @description Resolves a path relative to the repository root.
 * @param {...string} segments Path segments to join.
 * @returns {string} Absolute path from the process working directory.
 */
const resolveFromRoot = (...segments) => path.join(process.cwd(), ...segments);

describe('BREAK_CLOSENESS_WITH_TARGET schema regression test', () => {
  it('should have operation schema wired into rule validation', () => {
    const operationSchemaPath = resolveFromRoot(
      'data/schemas/operation.schema.json'
    );
    const breakClosenessSchemaPath = resolveFromRoot(
      'data/schemas/operations/breakClosenessWithTarget.schema.json'
    );
    const rulePath = resolveFromRoot(
      'data/mods/physical-control/rules/handle_push_off.rule.json'
    );

    expect(fs.existsSync(operationSchemaPath)).toBe(true);
    expect(fs.existsSync(breakClosenessSchemaPath)).toBe(true);
    expect(fs.existsSync(rulePath)).toBe(true);

    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );
    const references = operationSchema.$defs.Operation.anyOf.map(
      (entry) => entry.$ref
    );
    expect(references).toContain(
      './operations/breakClosenessWithTarget.schema.json'
    );

    const rule = JSON.parse(fs.readFileSync(rulePath, 'utf8'));
    const breakClosenessAction = rule.actions.find(
      (action) => action.type === 'BREAK_CLOSENESS_WITH_TARGET'
    );
    expect(breakClosenessAction).toBeDefined();
    expect(breakClosenessAction.parameters.actor_id).toBe(
      '{event.payload.actorId}'
    );
    expect(breakClosenessAction.parameters.target_id).toBe(
      '{event.payload.targetId}'
    );
  });

  it('should align operation registrations with schema references', () => {
    const registrationsPath = resolveFromRoot(
      'src/dependencyInjection/registrations/interpreterRegistrations.js'
    );
    const registrationsContent = fs.readFileSync(registrationsPath, 'utf8');

    expect(registrationsContent).toContain("'BREAK_CLOSENESS_WITH_TARGET'");
    expect(registrationsContent).toContain('BreakClosenessWithTargetHandler');

    const operationSchemaPath = resolveFromRoot(
      'data/schemas/operation.schema.json'
    );
    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );

    const hasBreakClosenessRef = operationSchema.$defs.Operation.anyOf.some(
      (entry) =>
        entry.$ref === './operations/breakClosenessWithTarget.schema.json'
    );
    expect(hasBreakClosenessRef).toBe(true);
  });

  it('should pass rule pre-validation for BREAK_CLOSENESS_WITH_TARGET usage', () => {
    const rulePath = resolveFromRoot(
      'data/mods/physical-control/rules/handle_push_off.rule.json'
    );
    const rule = JSON.parse(fs.readFileSync(rulePath, 'utf8'));

    const result = performPreValidation(
      rule,
      'schema://living-narrative-engine/rule.schema.json',
      rulePath
    );

    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });
});
