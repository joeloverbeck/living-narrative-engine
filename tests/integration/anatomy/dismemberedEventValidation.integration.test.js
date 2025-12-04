/**
 * @file Integration tests for anatomy event validation
 * Tests schema validation for anatomy:dismembered and anatomy:body_part_spawned events.
 * @see tickets/DISBODPARSPA-000-overview.md
 * @see tickets/DISBODPARSPA-032-integration-tests-spawning-flow.md
 * @see data/mods/anatomy/events/dismembered.event.json
 * @see data/mods/anatomy/events/body_part_spawned.event.json
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('anatomy:dismembered Event - Null Field Validation', () => {
  const EVENTS_DIR = 'data/mods/anatomy/events';

  let schemaValidator;
  let mockLogger;
  let dismemberedEvent;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load the dismembered event schema
    const filePath = path.resolve(EVENTS_DIR, 'dismembered.event.json');
    dismemberedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Register the payload schema
    const payloadSchemaId = `${dismemberedEvent.id}#payload`;
    await schemaValidator.addSchema(dismemberedEvent.payloadSchema, payloadSchemaId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Nullable field validation - reproducing runtime failure', () => {
    /**
     * This test reproduces the exact payload that caused the runtime failure:
     * SafeEventDispatcher: Underlying VED failed to dispatch event 'anatomy:dismembered' (returned false)
     *
     * The payload from the error:
     * {
     *   "entityId":"fantasy:rill_instance",
     *   "entityName":"Rill",
     *   "entityPronoun":"she",
     *   "partId":"c8517918-97d7-4061-b71e-c75a6f15f4c8",
     *   "partType":"vagina",
     *   "orientation":null,  <-- THIS IS THE PROBLEM
     *   "damageTypeId":"piercing",
     *   "timestamp":1764841605238
     * }
     */
    it('should accept payload with orientation: null (reproduces runtime bug)', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      // Exact payload that caused the runtime failure
      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        entityPronoun: 'she',
        partId: 'c8517918-97d7-4061-b71e-c75a6f15f4c8',
        partType: 'vagina',
        orientation: null, // <-- THIS CAUSES VALIDATION TO FAIL
        damageTypeId: 'piercing',
        timestamp: 1764841605238,
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);

      // Before fix: isValid will be false, errors will mention type mismatch
      // After fix: isValid should be true, errors should be null
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with partType: null', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        partType: null, // <-- Some parts don't have a type
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with entityName: null', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityName: null, // <-- Entity might not have a name
        partId: 'part-456',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with entityPronoun: null', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityPronoun: null, // <-- Entity might not have a pronoun
        partId: 'part-456',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with all optional metadata fields as null', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityName: null,
        entityPronoun: null,
        partId: 'part-456',
        partType: null,
        orientation: null,
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Consistency with damage_applied event schema', () => {
    it('should allow null orientation like damage_applied event does', async () => {
      // Load damage_applied event for comparison
      const damageAppliedPath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      const damageAppliedEvent = JSON.parse(fs.readFileSync(damageAppliedPath, 'utf8'));

      // damage_applied correctly uses type: ["string", "null"] for orientation
      const damageAppliedOrientationType = damageAppliedEvent.payloadSchema.properties.orientation.type;
      expect(damageAppliedOrientationType).toEqual(['string', 'null']);

      // dismembered should have the same pattern
      const dismemberedOrientationType = dismemberedEvent.payloadSchema.properties.orientation.type;

      // Before fix: this will fail because type is "string"
      // After fix: type should be ["string", "null"]
      expect(dismemberedOrientationType).toEqual(['string', 'null']);
    });

    it('should allow null partType like damage_applied event does', async () => {
      // Load damage_applied event for comparison
      const damageAppliedPath = path.resolve(EVENTS_DIR, 'damage_applied.event.json');
      const damageAppliedEvent = JSON.parse(fs.readFileSync(damageAppliedPath, 'utf8'));

      // damage_applied correctly uses type: ["string", "null"] for partType
      const damageAppliedPartType = damageAppliedEvent.payloadSchema.properties.partType.type;
      expect(damageAppliedPartType).toEqual(['string', 'null']);

      // dismembered should have the same pattern
      const dismemberedPartType = dismemberedEvent.payloadSchema.properties.partType.type;
      expect(dismemberedPartType).toEqual(['string', 'null']);
    });
  });

  describe('Required fields still enforced', () => {
    it('should still reject payload missing required entityId', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        // missing entityId
        partId: 'part-456',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityId')
      ).toBe(true);
    });

    it('should still reject payload missing required partId', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        // missing partId
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'partId')
      ).toBe(true);
    });

    it('should still reject payload missing required damageTypeId', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        // missing damageTypeId
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'damageTypeId')
      ).toBe(true);
    });

    it('should still reject payload missing required timestamp', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        damageTypeId: 'slashing',
        // missing timestamp
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'timestamp')
      ).toBe(true);
    });
  });

  describe('Valid string values still work', () => {
    it('should accept payload with all string values populated', async () => {
      const payloadSchemaId = `${dismemberedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        entityPronoun: 'she',
        partId: 'part-arm-left',
        partType: 'arm',
        orientation: 'left',
        damageTypeId: 'slashing',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });
});

/**
 * Tests for anatomy:body_part_spawned event schema validation.
 * This event is fired when a dismembered body part is spawned as a pickable entity.
 *
 * @see tickets/DISBODPARSPA-032-integration-tests-spawning-flow.md
 */
describe('anatomy:body_part_spawned Event - Schema Validation', () => {
  const EVENTS_DIR = 'data/mods/anatomy/events';

  let schemaValidator;
  let mockLogger;
  let bodyPartSpawnedEvent;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load the body_part_spawned event schema
    const filePath = path.resolve(EVENTS_DIR, 'body_part_spawned.event.json');
    bodyPartSpawnedEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Register the payload schema
    const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;
    await schemaValidator.addSchema(bodyPartSpawnedEvent.payloadSchema, payloadSchemaId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Required fields enforcement', () => {
    it('should reject payload missing required entityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        // missing entityId
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityId')
      ).toBe(true);
    });

    it('should reject payload missing required entityName', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        // missing entityName
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'entityName')
      ).toBe(true);
    });

    it('should reject payload missing required spawnedEntityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        // missing spawnedEntityId
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'spawnedEntityId')
      ).toBe(true);
    });

    it('should reject payload missing required spawnedEntityName', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        // missing spawnedEntityName
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'spawnedEntityName')
      ).toBe(true);
    });

    it('should reject payload missing required partType', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        // missing partType
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'partType')
      ).toBe(true);
    });

    it('should reject payload missing required definitionId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        // missing definitionId
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'definitionId')
      ).toBe(true);
    });

    it('should reject payload missing required timestamp', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        // missing timestamp
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.params?.missingProperty === 'timestamp')
      ).toBe(true);
    });
  });

  describe('Nullable orientation field handling', () => {
    it('should accept payload with orientation: null', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's head",
        partType: 'head',
        orientation: null, // Head has no orientation
        definitionId: 'anatomy:humanoid_head',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with orientation as string', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        orientation: 'left',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload without orientation field (optional)', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's head",
        partType: 'head',
        // orientation omitted entirely
        definitionId: 'anatomy:humanoid_head',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Valid payload acceptance', () => {
    it('should accept complete valid payload with all fields', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-arm-left-uuid',
        spawnedEntityName: "Rill's left arm",
        partType: 'arm',
        orientation: 'left',
        definitionId: 'anatomy:humanoid_arm',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload for internal organ spawning', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-heart-uuid',
        spawnedEntityName: "Rill's heart",
        partType: 'heart',
        orientation: null, // Internal organs typically have no orientation
        definitionId: 'anatomy:human_heart',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('additionalProperties enforcement', () => {
    it('should reject payload with unknown properties', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Rill's left leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
        unknownField: 'should not be allowed', // Extra field
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((err) => err.keyword === 'additionalProperties')
      ).toBe(true);
    });
  });
});
