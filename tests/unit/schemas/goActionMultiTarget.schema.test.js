import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import goActionMigrated from '../../../data/mods/core/actions/go.action.json';

describe('Go Action Multi-Target Schema Validation', () => {
  let ajv;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    ajv.addSchema(jsonLogicSchema);
    ajv.addSchema(conditionContainerSchema);
  });

  it('validates migrated go.action.json against action schema', () => {
    const valid = ajv.validate(actionSchema, goActionMigrated);
    if (!valid) {
      console.error('Schema validation errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });

  it('ensures targets structure is properly defined', () => {
    expect(goActionMigrated.targets).toBeDefined();
    expect(goActionMigrated.targets.primary).toBeDefined();
    expect(goActionMigrated.targets.primary.scope).toBe('core:clear_directions');
    expect(goActionMigrated.targets.primary.placeholder).toBe('destination');
    expect(goActionMigrated.targets.primary.description).toBe('Location to move to');
  });

  it('ensures template uses new placeholder', () => {
    expect(goActionMigrated.template).toBe('go to {destination}');
  });

  it('ensures legacy scope property is not present', () => {
    expect(goActionMigrated.scope).toBeUndefined();
  });

  it('maintains all other required properties', () => {
    expect(goActionMigrated.id).toBe('core:go');
    expect(goActionMigrated.name).toBe('Go');
    expect(goActionMigrated.description).toBe('Moves your character to the specified location, if the way is clear.');
    expect(goActionMigrated.prerequisites).toBeDefined();
    expect(goActionMigrated.prerequisites).toHaveLength(1);
    expect(goActionMigrated.prerequisites[0].logic.condition_ref).toBe('core:actor-can-move');
    expect(goActionMigrated.prerequisites[0].failure_message).toBe('You cannot move without functioning legs.');
  });
});