import { beforeAll, describe, expect, test } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import applyDamageSchema from '../../../../data/schemas/operations/applyDamage.schema.json';
import baseOperationSchema from '../../../../data/schemas/base-operation.schema.json';
import commonSchema from '../../../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../../../data/schemas/condition-container.schema.json';
import damageCapabilitySchema from '../../../../data/schemas/damage-capability-entry.schema.json';
import jsonLogicSchema from '../../../../data/schemas/json-logic.schema.json';

describe('APPLY_DAMAGE operation schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      strict: false,
      allErrors: true,
      allowUnionTypes: true,
    });
    addFormats(ajv);
    ajv.addSchema(commonSchema, commonSchema.$id);
    ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
    ajv.addSchema(conditionContainerSchema, conditionContainerSchema.$id);
    ajv.addSchema(baseOperationSchema, baseOperationSchema.$id);
    ajv.addSchema(damageCapabilitySchema, damageCapabilitySchema.$id);
    validate = ajv.compile(applyDamageSchema);
  });

  test('accepts legacy payload with amount and damage_type', () => {
    const operation = {
      type: 'APPLY_DAMAGE',
      parameters: {
        entity_ref: 'target-1',
        amount: 10,
        damage_type: 'blunt',
      },
    };

    expect(validate(operation)).toBe(true);
  });

  test('accepts extended payload with metadata, tags, hit_strategy, and rng_ref', () => {
    const operation = {
      type: 'APPLY_DAMAGE',
      parameters: {
        entity_ref: 'target-2',
        damage_entry: { name: 'slashing', amount: 12 },
        metadata: { weaponId: 'sword-1', actionId: 'swing' },
        damage_tags: ['ranged', 'fire'],
        hit_strategy: {
          reuse_cached: false,
          hint_part: 'torso-part',
        },
        rng_ref: 'seeded-hit',
      },
    };

    const isValid = validate(operation);
    if (!isValid) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('rejects invalid damage_tags type', () => {
    const operation = {
      type: 'APPLY_DAMAGE',
      parameters: {
        entity_ref: 'target-3',
        amount: 5,
        damage_type: 'piercing',
        damage_tags: 'fire',
      },
    };

    expect(validate(operation)).toBe(false);
  });
});
