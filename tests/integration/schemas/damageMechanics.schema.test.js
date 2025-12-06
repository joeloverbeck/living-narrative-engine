import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, test, expect, beforeAll } from '@jest/globals';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('Damage Mechanics Schemas', () => {
  let validateHealth;
  let validatePart;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema, commonSchema.$id);

    const healthPath = path.resolve(
      __dirname,
      '../../../data/mods/anatomy/components/part_health.component.json'
    );
    const partPath = path.resolve(
      __dirname,
      '../../../data/mods/anatomy/components/part.component.json'
    );

    const healthComp = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
    const partComp = JSON.parse(fs.readFileSync(partPath, 'utf8'));

    validateHealth = ajv.compile({
      ...healthComp.dataSchema,
      $id: healthComp.id,
    });
    validatePart = ajv.compile({ ...partComp.dataSchema, $id: partComp.id });
  });

  describe('anatomy:part_health (Existing)', () => {
    test('validates valid payload', () => {
      const payload = {
        currentHealth: 50,
        maxHealth: 100,
        state: 'wounded',
        turnsInState: 0,
      };
      expect(validateHealth(payload)).toBe(true);
    });

    test('rejects invalid enum value', () => {
      const payload = {
        currentHealth: 50,
        maxHealth: 100,
        state: 'Healthy', // Capitalized not allowed in existing schema
      };
      expect(validateHealth(payload)).toBe(false);
    });

    test('rejects missing required fields', () => {
      const payload = {
        state: 'healthy',
      };
      expect(validateHealth(payload)).toBe(false);
    });
  });

  describe('anatomy:part (Extended)', () => {
    test('validates legacy payload (backward compatibility)', () => {
      const payload = {
        subType: 'arm',
      };
      expect(validatePart(payload)).toBe(true);
    });

    test('validates new hit_probability_weight', () => {
      const payload = {
        subType: 'arm',
        hit_probability_weight: 1.5,
      };
      expect(validatePart(payload)).toBe(true);
    });
  });
});
