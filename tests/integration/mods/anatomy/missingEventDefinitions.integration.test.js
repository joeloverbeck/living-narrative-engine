/**
 * @file Integration tests for anatomy event definitions
 * Verifies that anatomy event definitions exist and are properly loaded by the event system.
 * Tests: damage_applied, bleeding_started, part_destroyed, dismembered, body_part_spawned
 * @see specs/damage-types-and-special-effects.md
 * @see specs/dismembered-body-part-spawning.md
 * @see tickets/DAMTYPANDSPEEFF-004-event-and-propagation-integration.md
 * @see tickets/DISBODPARSPA-002-body-part-spawned-event.md
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Anatomy Event Definitions - damage_applied, bleeding_started, part_destroyed, dismembered', () => {
  const EVENTS_DIR = 'data/mods/anatomy/events';
  const EVENT_SCHEMA_PATH = 'data/schemas/event.schema.json';

  let schemaValidator;
  let mockLogger;
  let eventSchema;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load the event schema for validation
    eventSchema = JSON.parse(
      fs.readFileSync(path.resolve(EVENT_SCHEMA_PATH), 'utf8')
    );

    if (!schemaValidator.isSchemaLoaded(eventSchema.$id || EVENT_SCHEMA_PATH)) {
      await schemaValidator.addSchema(
        eventSchema,
        eventSchema.$id || EVENT_SCHEMA_PATH
      );
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Definition File Existence', () => {
    it('should have damage_applied.event.json file in anatomy events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have bleeding_started.event.json file in anatomy events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'bleeding_started.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have part_destroyed.event.json file in anatomy events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'part_destroyed.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have dismembered.event.json file in anatomy events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'dismembered.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have body_part_spawned.event.json file in anatomy events', () => {
      const filePath = path.resolve(EVENTS_DIR, 'body_part_spawned.event.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Event Definition File Structure', () => {
    it('damage_applied.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('anatomy:damage_applied');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });

    it('bleeding_started.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'bleeding_started.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('anatomy:bleeding_started');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });

    it('part_destroyed.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'part_destroyed.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('anatomy:part_destroyed');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });

    it('dismembered.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'dismembered.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('anatomy:dismembered');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });

    it('body_part_spawned.event.json should have valid JSON structure', () => {
      const filePath = path.resolve(EVENTS_DIR, 'body_part_spawned.event.json');
      const content = fs.readFileSync(filePath, 'utf8');

      let parsed;
      expect(() => {
        parsed = JSON.parse(content);
      }).not.toThrow();

      // Verify required fields per event.schema.json
      expect(parsed.id).toBe('anatomy:body_part_spawned');
      expect(parsed.description).toBeDefined();
      expect(parsed.payloadSchema).toBeDefined();
      expect(parsed.payloadSchema.type).toBe('object');
      expect(parsed.payloadSchema.properties).toBeDefined();
      expect(parsed.payloadSchema.required).toBeDefined();
    });
  });

  describe('anatomy:damage_applied Payload Schema Validation', () => {
    let damageAppliedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      damageAppliedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid damage_applied payload with all required fields', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        amount: 25.5,
        damageType: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept valid damage_applied payload with optional propagatedFrom field', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        amount: 10,
        damageType: 'bludgeoning',
        propagatedFrom: 'source-part-789',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
    });

    it('should accept valid damage_applied payload with null propagatedFrom', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        amount: 5,
        damageType: 'piercing',
        propagatedFrom: null,
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
    });

    it('should accept damage_applied payload emitted by ApplyDamageHandler with metadata and damageTags', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const productionPayloadShape = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        entityPronoun: 'she',
        partId: '880b414b-e9d4-41af-8d58-a7c2e262bae4',
        partType: 'breast',
        orientation: 'left',
        amount: 2,
        damageType: 'piercing',
        propagatedFrom: null,
        metadata: {},
        damageTags: [],
        timestamp: 1765042590344,
      };

      const result = schemaValidator.validate(
        payloadSchemaId,
        productionPayloadShape
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject damage_applied payload missing required entityId', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        // missing entityId
        partId: 'part-456',
        amount: 10,
        damageType: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityId')
      ).toBe(true);
    });

    it('should reject damage_applied payload with negative amount', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        amount: -5, // negative amount should be rejected
        damageType: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject damage_applied payload with additional properties', async () => {
      const payloadSchemaId = `${damageAppliedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        damageAppliedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        amount: 10,
        damageType: 'slashing',
        timestamp: Date.now(),
        unknownField: 'should not be allowed',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('anatomy:bleeding_started Payload Schema Validation', () => {
    let bleedingStartedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'bleeding_started.event.json');
      bleedingStartedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid bleeding_started payload with all required fields', async () => {
      const payloadSchemaId = `${bleedingStartedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bleedingStartedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        severity: 'moderate',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept all valid severity levels', async () => {
      const payloadSchemaId = `${bleedingStartedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bleedingStartedEvent.payloadSchema,
        payloadSchemaId
      );

      const severityLevels = ['minor', 'moderate', 'severe', 'critical'];

      for (const severity of severityLevels) {
        const validPayload = {
          entityId: 'entity-123',
          partId: 'part-456',
          severity,
          timestamp: Date.now(),
        };

        const result = schemaValidator.validate(payloadSchemaId, validPayload);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject bleeding_started payload missing required partId', async () => {
      const payloadSchemaId = `${bleedingStartedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bleedingStartedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        // missing partId
        severity: 'moderate',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'partId')
      ).toBe(true);
    });

    it('should reject bleeding_started payload with invalid severity', async () => {
      const payloadSchemaId = `${bleedingStartedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bleedingStartedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        severity: 'extreme', // not in allowed enum values
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject bleeding_started payload with additional properties', async () => {
      const payloadSchemaId = `${bleedingStartedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bleedingStartedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        severity: 'moderate',
        timestamp: Date.now(),
        extraField: 'should fail',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('anatomy:part_destroyed Payload Schema Validation', () => {
    let partDestroyedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'part_destroyed.event.json');
      partDestroyedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid part_destroyed payload with all required fields', async () => {
      const payloadSchemaId = `${partDestroyedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        partDestroyedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject part_destroyed payload missing required entityId', async () => {
      const payloadSchemaId = `${partDestroyedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        partDestroyedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        // missing entityId
        partId: 'part-456',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityId')
      ).toBe(true);
    });

    it('should reject part_destroyed payload missing required partId', async () => {
      const payloadSchemaId = `${partDestroyedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        partDestroyedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        // missing partId
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'partId')
      ).toBe(true);
    });

    it('should reject part_destroyed payload with additional properties', async () => {
      const payloadSchemaId = `${partDestroyedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        partDestroyedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        timestamp: Date.now(),
        extraField: 'should fail',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('anatomy:dismembered Payload Schema Validation', () => {
    let dismemberedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'dismembered.event.json');
      dismemberedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid dismembered payload with all required fields', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        dismemberedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept valid dismembered payload with all optional fields', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        dismemberedEvent.payloadSchema,
        payloadSchemaId
      );

      // This is the full payload that damageTypeEffectsService.js dispatches
      const validPayload = {
        entityId: 'entity-123',
        entityName: 'Player Character',
        entityPronoun: 'they',
        partId: 'part-456',
        partType: 'arm',
        orientation: 'left',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject dismembered payload missing required damageTypeId', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        dismemberedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        // missing damageTypeId
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some(
          (err) => err.params?.missingProperty === 'damageTypeId'
        )
      ).toBe(true);
    });

    it('should reject dismembered payload missing required partId', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        dismemberedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        // missing partId
        damageTypeId: 'crushing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'partId')
      ).toBe(true);
    });

    it('should reject dismembered payload with unknown additional properties', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        dismemberedEvent.payloadSchema,
        payloadSchemaId
      );

      // Use a truly unknown field that is NOT part of the schema
      // (entityName, entityPronoun, partType, orientation are now allowed)
      const invalidPayload = {
        entityId: 'entity-123',
        partId: 'part-456',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
        unknownField: 'should fail',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Event Definition Consistency with Production Code', () => {
    it('damage_applied event schema should match applyDamageHandler dispatch payload', () => {
      const filePath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields dispatched by applyDamageHandler.js:399-406 are defined
      expect(props.entityId).toBeDefined();
      expect(props.partId).toBeDefined();
      expect(props.amount).toBeDefined();
      expect(props.damageType).toBeDefined();
      expect(props.propagatedFrom).toBeDefined();
      expect(props.timestamp).toBeDefined();

      // Verify required fields match (propagatedFrom is optional)
      expect(required).toContain('entityId');
      expect(required).toContain('partId');
      expect(required).toContain('amount');
      expect(required).toContain('damageType');
      expect(required).toContain('timestamp');
      expect(required).not.toContain('propagatedFrom');
    });

    it('bleeding_started event schema should match damageTypeEffectsService dispatch payload', () => {
      const filePath = path.resolve(EVENTS_DIR, 'bleeding_started.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields dispatched by damageTypeEffectsService.js:280-285 are defined
      expect(props.entityId).toBeDefined();
      expect(props.partId).toBeDefined();
      expect(props.severity).toBeDefined();
      expect(props.timestamp).toBeDefined();

      // Verify all fields are required
      expect(required).toContain('entityId');
      expect(required).toContain('partId');
      expect(required).toContain('severity');
      expect(required).toContain('timestamp');
    });

    it('damage_applied amount field should accept numeric values with minimum 0', () => {
      const filePath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const amountSchema = eventDef.payloadSchema.properties.amount;

      expect(amountSchema.type).toBe('number');
      expect(amountSchema.minimum).toBe(0);
    });

    it('bleeding_started severity field should use the correct enum values', () => {
      const filePath = path.resolve(EVENTS_DIR, 'bleeding_started.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const severitySchema = eventDef.payloadSchema.properties.severity;

      expect(severitySchema.type).toBe('string');
      expect(severitySchema.enum).toEqual([
        'minor',
        'moderate',
        'severe',
        'critical',
      ]);
    });

    it('part_destroyed event schema should match applyDamageHandler dispatch payload', () => {
      const filePath = path.resolve(EVENTS_DIR, 'part_destroyed.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields dispatched by applyDamageHandler.js:554-558 are defined
      expect(props.entityId).toBeDefined();
      expect(props.partId).toBeDefined();
      expect(props.timestamp).toBeDefined();

      // Verify required fields match
      expect(required).toContain('entityId');
      expect(required).toContain('partId');
      expect(required).toContain('timestamp');

      // Verify field types
      expect(props.entityId.type).toBe('string');
      expect(props.partId.type).toBe('string');
      expect(props.timestamp.type).toBe('integer');
    });

    it('dismembered event schema should match damageTypeEffectsService dispatch payload', () => {
      const filePath = path.resolve(EVENTS_DIR, 'dismembered.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields dispatched by damageTypeEffectsService.js:223-232 are defined
      // Required fields
      expect(props.entityId).toBeDefined();
      expect(props.partId).toBeDefined();
      expect(props.damageTypeId).toBeDefined();
      expect(props.timestamp).toBeDefined();

      // Optional fields for UI rendering (also dispatched by damageTypeEffectsService)
      expect(props.entityName).toBeDefined();
      expect(props.entityPronoun).toBeDefined();
      expect(props.partType).toBeDefined();
      expect(props.orientation).toBeDefined();

      // Verify required fields (only the core 4)
      expect(required).toContain('entityId');
      expect(required).toContain('partId');
      expect(required).toContain('damageTypeId');
      expect(required).toContain('timestamp');

      // Verify optional fields are NOT required
      expect(required).not.toContain('entityName');
      expect(required).not.toContain('entityPronoun');
      expect(required).not.toContain('partType');
      expect(required).not.toContain('orientation');

      // Verify field types
      expect(props.entityId.type).toBe('string');
      expect(props.partId.type).toBe('string');
      expect(props.damageTypeId.type).toBe('string');
      expect(props.timestamp.type).toBe('integer');
      // Nullable fields should allow both string and null
      expect(props.entityName.type).toEqual(['string', 'null']);
      expect(props.entityPronoun.type).toEqual(['string', 'null']);
      expect(props.partType.type).toEqual(['string', 'null']);
      expect(props.orientation.type).toEqual(['string', 'null']);
    });
  });

  describe('anatomy:body_part_spawned Payload Schema Validation', () => {
    let bodyPartSpawnedEvent;

    beforeEach(() => {
      const filePath = path.resolve(EVENTS_DIR, 'body_part_spawned.event.json');
      bodyPartSpawnedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    it('should accept valid body_part_spawned payload with all required fields', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bodyPartSpawnedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-sarah-123',
        entityName: 'Sarah',
        spawnedEntityId: 'entity-spawned-leg-456',
        spawnedEntityName: "Sarah's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept valid body_part_spawned payload with optional orientation field', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bodyPartSpawnedEvent.payloadSchema,
        payloadSchemaId
      );

      const validPayload = {
        entityId: 'entity-123',
        entityName: 'John',
        spawnedEntityId: 'entity-arm-456',
        spawnedEntityName: "John's left arm",
        partType: 'arm',
        orientation: 'left',
        definitionId: 'anatomy:human_arm',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, validPayload);
      expect(result.isValid).toBe(true);
    });

    it('should reject body_part_spawned payload missing required entityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bodyPartSpawnedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        // missing entityId
        entityName: 'Sarah',
        spawnedEntityId: 'entity-spawned-leg-456',
        spawnedEntityName: "Sarah's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityId')
      ).toBe(true);
    });

    it('should reject body_part_spawned payload missing required spawnedEntityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bodyPartSpawnedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        entityName: 'Sarah',
        // missing spawnedEntityId
        spawnedEntityName: "Sarah's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some(
          (err) => err.params?.missingProperty === 'spawnedEntityId'
        )
      ).toBe(true);
    });

    it('should reject body_part_spawned payload with additional properties', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      // Register the payload schema
      await schemaValidator.addSchema(
        bodyPartSpawnedEvent.payloadSchema,
        payloadSchemaId
      );

      const invalidPayload = {
        entityId: 'entity-123',
        entityName: 'Sarah',
        spawnedEntityId: 'entity-spawned-leg-456',
        spawnedEntityName: "Sarah's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
        unknownField: 'should not be allowed',
      };

      const result = schemaValidator.validate(payloadSchemaId, invalidPayload);
      expect(result.isValid).toBe(false);
    });

    it('body_part_spawned event schema should have correct field definitions for spawner service', () => {
      const filePath = path.resolve(EVENTS_DIR, 'body_part_spawned.event.json');
      const eventDef = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const props = eventDef.payloadSchema.properties;
      const required = eventDef.payloadSchema.required;

      // Verify all fields that DismemberedBodyPartSpawner will dispatch are defined
      expect(props.entityId).toBeDefined();
      expect(props.entityName).toBeDefined();
      expect(props.spawnedEntityId).toBeDefined();
      expect(props.spawnedEntityName).toBeDefined();
      expect(props.partType).toBeDefined();
      expect(props.orientation).toBeDefined();
      expect(props.definitionId).toBeDefined();
      expect(props.timestamp).toBeDefined();

      // Verify required fields (orientation is optional for parts like head/torso)
      expect(required).toContain('entityId');
      expect(required).toContain('entityName');
      expect(required).toContain('spawnedEntityId');
      expect(required).toContain('spawnedEntityName');
      expect(required).toContain('partType');
      expect(required).toContain('definitionId');
      expect(required).toContain('timestamp');
      expect(required).not.toContain('orientation');

      // Verify field types
      expect(props.entityId.type).toBe('string');
      expect(props.entityName.type).toBe('string');
      expect(props.spawnedEntityId.type).toBe('string');
      expect(props.spawnedEntityName.type).toBe('string');
      expect(props.partType.type).toBe('string');
      // orientation is nullable (can be "left", "right", "mid", or null for parts without orientation)
      expect(props.orientation.type).toEqual(['string', 'null']);
      expect(props.definitionId.type).toBe('string');
      expect(props.timestamp.type).toBe('integer');
    });
  });
});
