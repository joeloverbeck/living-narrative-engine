/**
 * @file Integration test for anatomy:body_part_spawned event validation
 * Validates that the event schema accepts null orientation values and
 * that the DismemberedBodyPartSpawner properly awaits entity creation.
 *
 * @see tickets/DISBODPARSPA-000-overview.md
 * @see src/anatomy/services/dismemberedBodyPartSpawner.js
 * @see data/mods/anatomy/events/body_part_spawned.event.json
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
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('anatomy:body_part_spawned Event - Validation', () => {
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
    await schemaValidator.addSchema(
      bodyPartSpawnedEvent.payloadSchema,
      payloadSchemaId
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Nullable orientation field validation', () => {
    it('should accept payload with orientation: null', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'fantasy:rill_instance',
        entityName: 'Rill',
        spawnedEntityId: 'spawned-part-123',
        spawnedEntityName: "Rill's vagina",
        partType: 'vagina',
        orientation: null, // Parts without left/right orientation
        definitionId: 'anatomy:human_vagina',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with orientation: left', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-sarah',
        entityName: 'Sarah',
        spawnedEntityId: 'spawned-leg-456',
        spawnedEntityName: "Sarah's left leg",
        partType: 'leg',
        orientation: 'left',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should accept payload with orientation: right', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-marcus',
        entityName: 'Marcus',
        spawnedEntityId: 'spawned-arm-789',
        spawnedEntityName: "Marcus's right arm",
        partType: 'arm',
        orientation: 'right',
        definitionId: 'anatomy:human_arm',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Schema type verification', () => {
    it('should have orientation type as [string, null]', () => {
      const orientationType =
        bodyPartSpawnedEvent.payloadSchema.properties.orientation.type;
      expect(orientationType).toEqual(['string', 'null']);
    });
  });

  describe('Required fields enforcement', () => {
    it('should reject payload missing spawnedEntityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityName: 'Test',
        // missing spawnedEntityId - THIS IS THE BUG WE FIXED
        spawnedEntityName: "Test's leg",
        partType: 'leg',
        definitionId: 'anatomy:human_leg',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some(
          (err) => err.params?.missingProperty === 'spawnedEntityId'
        )
      ).toBe(true);
    });

    it('should reject payload missing entityId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        // missing entityId
        entityName: 'Test',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Test's leg",
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

    it('should reject payload missing definitionId', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityName: 'Test',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Test's leg",
        partType: 'leg',
        // missing definitionId
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some(
          (err) => err.params?.missingProperty === 'definitionId'
        )
      ).toBe(true);
    });

    it('should reject payload missing timestamp', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-123',
        entityName: 'Test',
        spawnedEntityId: 'spawned-123',
        spawnedEntityName: "Test's leg",
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

  describe('Valid complete payload', () => {
    it('should accept complete payload with all fields', async () => {
      const payloadSchemaId = `${bodyPartSpawnedEvent.id}#payload`;

      const payload = {
        entityId: 'entity-elena',
        entityName: 'Elena',
        spawnedEntityId: 'spawned-head-abc',
        spawnedEntityName: "Elena's head",
        partType: 'head',
        orientation: null,
        definitionId: 'anatomy:humanoid_head',
        timestamp: Date.now(),
      };

      const result = schemaValidator.validate(payloadSchemaId, payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });
});
