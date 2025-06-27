import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

describe('core:turn_started Event Schema Validation', () => {
  let ajv;
  let validate;
  let turnStartedEvent;

  beforeAll(() => {
    // Load the event definition
    const eventPath = path.join(
      process.cwd(),
      'data/mods/core/events/turn_started.event.json'
    );
    turnStartedEvent = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));

    // Setup AJV with the schema
    ajv = new Ajv({ strict: true, allErrors: true });
    
    // Add common schema if needed
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    ajv.addSchema(commonSchema, commonSchema.$id);
    
    validate = ajv.compile(turnStartedEvent.payloadSchema);
  });

  describe('Valid payloads', () => {
    it('should accept minimal payload without entity', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'player'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept payload with entity object', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'ai',
        entity: {
          id: 'test:entity1',
          components: {
            'core:player_type': { type: 'llm' },
            'core:actor': {}
          }
        }
      };
      
      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept entity with any structure', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'player',
        entity: {
          id: 'test:entity1',
          components: {
            'custom:component': { 
              nested: { 
                data: 'value',
                array: [1, 2, 3]
              }
            }
          },
          customProperty: 'allowed',
          anotherProp: { foo: 'bar' }
        }
      };
      
      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid payloads', () => {
    it('should reject payload without entityId', () => {
      const payload = {
        entityType: 'player'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].instancePath).toBe('');
      expect(validate.errors[0].message).toContain('required property \'entityId\'');
    });

    it('should reject payload without entityType', () => {
      const payload = {
        entityId: 'test:entity1'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('required property \'entityType\'');
    });

    it('should reject invalid entityType values', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'invalid'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must be equal to one of the allowed values');
    });

    it('should reject additional properties at root level', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'player',
        extraProp: 'not allowed'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must NOT have additional properties');
    });

    it('should reject non-object entity property', () => {
      const payload = {
        entityId: 'test:entity1',
        entityType: 'ai',
        entity: 'not an object'
      };
      
      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].instancePath).toBe('/entity');
      expect(validate.errors[0].message).toContain('must be object');
    });
  });

  describe('Schema structure', () => {
    it('should have correct required fields', () => {
      expect(turnStartedEvent.payloadSchema.required).toEqual(['entityId', 'entityType']);
    });

    it('should not allow additional properties at root', () => {
      expect(turnStartedEvent.payloadSchema.additionalProperties).toBe(false);
    });

    it('should allow additional properties in entity object', () => {
      expect(turnStartedEvent.payloadSchema.properties.entity.additionalProperties).toBe(true);
    });
  });
});