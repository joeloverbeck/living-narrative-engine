import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import { ROUND_STARTED_ID } from '../../../src/constants/eventIds.js';
import fs from 'fs';
import path from 'path';

describe('core:round_started Event Validation', () => {
  let ajv;
  let validate;
  let roundStartedDef;
  let roundStartedSchema;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true, strict: false });

    // Load common schema for referenced definitions
    const commonSchemaPath = path.join(process.cwd(), 'data/schemas/common.schema.json');
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf8'));
    ajv.addSchema(commonSchema, 'schema://living-narrative-engine/common.schema.json');

    // Load event schema directly
    const eventDir = path.join(process.cwd(), 'data/mods/core/events');
    roundStartedDef = JSON.parse(
      fs.readFileSync(path.join(eventDir, 'round_started.event.json'), 'utf8')
    );
    roundStartedSchema = roundStartedDef.payloadSchema;

    // Compile the schema
    validate = ajv.compile(roundStartedSchema);
  });

  describe('Event Definition Loading', () => {
    it('should load the core:round_started event definition from the core mod', () => {
      expect(roundStartedDef).toBeDefined();
      expect(roundStartedDef.id).toBe('core:round_started');
      expect(roundStartedDef.description).toContain('round begins');
    });

    it('should have the correct payload schema structure', () => {
      expect(roundStartedSchema).toBeDefined();
      expect(roundStartedSchema.type).toBe('object');
      expect(roundStartedSchema.properties).toBeDefined();
      expect(roundStartedSchema.properties.roundNumber).toBeDefined();
      expect(roundStartedSchema.properties.actors).toBeDefined();
      expect(roundStartedSchema.properties.strategy).toBeDefined();
    });

    it('should require roundNumber, actors, and strategy fields', () => {
      expect(roundStartedSchema.required).toEqual([
        'roundNumber',
        'actors',
        'strategy',
      ]);
    });
  });

  describe('Payload Validation', () => {
    it('should validate a correct payload successfully', () => {
      const validPayload = {
        roundNumber: 1,
        actors: ['actor1', 'actor2'],
        strategy: 'round-robin',
      };

      const isValid = validate(validPayload);
      expect(isValid).toBe(true);
    });

    it('should validate payload with initiative strategy', () => {
      const validPayload = {
        roundNumber: 2,
        actors: ['core:actor1', 'core:actor2', 'core:actor3'],
        strategy: 'initiative',
      };

      const isValid = validate(validPayload);
      expect(isValid).toBe(true);
    });

    it('should reject payload with missing roundNumber', () => {
      const invalidPayload = {
        actors: ['actor1'],
        strategy: 'round-robin',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with missing actors', () => {
      const invalidPayload = {
        roundNumber: 1,
        strategy: 'round-robin',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with missing strategy', () => {
      const invalidPayload = {
        roundNumber: 1,
        actors: ['actor1'],
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with invalid strategy value', () => {
      const invalidPayload = {
        roundNumber: 1,
        actors: ['actor1'],
        strategy: 'invalid-strategy',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with invalid roundNumber type', () => {
      const invalidPayload = {
        roundNumber: '1', // Should be number, not string
        actors: ['actor1'],
        strategy: 'round-robin',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with invalid actors type', () => {
      const invalidPayload = {
        roundNumber: 1,
        actors: 'actor1', // Should be array, not string
        strategy: 'round-robin',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });

    it('should reject payload with additional properties', () => {
      const invalidPayload = {
        roundNumber: 1,
        actors: ['actor1'],
        strategy: 'round-robin',
        extraField: 'not allowed',
      };

      const isValid = validate(invalidPayload);
      expect(isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should validate payload with empty actors array', () => {
      const validPayload = {
        roundNumber: 1,
        actors: [],
        strategy: 'round-robin',
      };

      const isValid = validate(validPayload);
      expect(isValid).toBe(true);
    });

    it('should validate payload with high round numbers', () => {
      const validPayload = {
        roundNumber: 999999,
        actors: ['actor1'],
        strategy: 'initiative',
      };

      const isValid = validate(validPayload);
      expect(isValid).toBe(true);
    });

    it('should validate payload with many actors', () => {
      const manyActors = Array.from({ length: 100 }, (_, i) => `actor${i}`);
      const validPayload = {
        roundNumber: 1,
        actors: manyActors,
        strategy: 'round-robin',
      };

      const isValid = validate(validPayload);
      expect(isValid).toBe(true);
    });
  });
});
