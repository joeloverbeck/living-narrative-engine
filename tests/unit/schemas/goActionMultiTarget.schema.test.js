import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import goActionMigrated from '../../../data/mods/movement/actions/go.action.json';

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
    expect(goActionMigrated.targets.primary.scope).toBe(
      'movement:clear_directions'
    );
    expect(goActionMigrated.targets.primary.placeholder).toBe('destination');
    expect(goActionMigrated.targets.primary.description).toBe(
      'Location to move to'
    );
  });

  it('ensures template uses new placeholder', () => {
    expect(goActionMigrated.template).toBe('go to {destination}');
  });

  it('ensures legacy scope property is not present', () => {
    expect(goActionMigrated.scope).toBeUndefined();
  });

  it('maintains all other required properties', () => {
    expect(goActionMigrated.id).toBe('movement:go');
    expect(goActionMigrated.name).toBe('Go');
    expect(goActionMigrated.description).toBe(
      'Moves your character to the specified location.'
    );
    expect(goActionMigrated.prerequisites).toBeDefined();
    expect(goActionMigrated.prerequisites).toHaveLength(2);
    expect(goActionMigrated.prerequisites[0].logic.condition_ref).toBe(
      'anatomy:actor-can-move'
    );
    expect(goActionMigrated.prerequisites[0].failure_message).toBe(
      'You cannot move without functioning legs.'
    );
    expect(goActionMigrated.prerequisites[1].logic.isActorLocationLit).toEqual([
      'actor',
    ]);
    expect(goActionMigrated.prerequisites[1].failure_message).toBe(
      'It is too dark to see where you are going.'
    );
  });
});
