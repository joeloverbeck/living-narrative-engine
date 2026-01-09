/**
 * @file poisonEventValidation.integration.test.js
 * @description Integration tests verifying poisoned_started and poisoned_stopped event schemas
 * accept the payload structure sent by PoisonApplicator and PoisonTickSystem.
 *
 * Reproduces validation failure:
 * VED: Payload validation FAILED for event 'anatomy:poisoned_started'.
 * Dispatch SKIPPED. Errors: [root]: must NOT have additional properties
 *
 * Root cause: poisonApplicator.js sends `scope` property not defined in schema.
 * @see poisonApplicator.js - Sends poisoned_started event with scope property
 * @see poisonTickSystem.js - Sends poisoned_stopped event with scope property
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ANATOMY_EVENTS_DIR = path.resolve('data/mods/anatomy/events');

describe('Poison Event Schema Validation', () => {
  let ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true, strict: false });
  });

  describe('anatomy:poisoned_started event validation', () => {
    let schema;

    beforeAll(() => {
      const eventDefinition = JSON.parse(
        fs.readFileSync(
          path.join(ANATOMY_EVENTS_DIR, 'poisoned_started.event.json'),
          'utf-8'
        )
      );
      schema = eventDefinition.payloadSchema;
    });

    it('should accept payload with scope="part" and partId', () => {
      // This is the payload structure sent by poisonApplicator.js for part-scoped poison
      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        scope: 'part',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept payload with scope="entity" and null partId', () => {
      // This is the payload structure sent by poisonApplicator.js for entity-scoped poison
      // When scope is 'entity', partId is set to undefined (serializes as null/absent)
      const payload = {
        entityId: 'entity-123',
        partId: null,
        scope: 'entity',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept payload with scope="entity" and no partId property', () => {
      // When scope is 'entity', partId can be omitted entirely
      const payload = {
        entityId: 'entity-123',
        scope: 'entity',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject payload missing required entityId', () => {
      const payload = {
        partId: 'part-456',
        scope: 'part',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'entityId'
        )
      ).toBe(true);
    });

    it('should reject payload missing required scope', () => {
      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'scope'
        )
      ).toBe(true);
    });

    it('should reject payload missing required timestamp', () => {
      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        scope: 'part',
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'timestamp'
        )
      ).toBe(true);
    });

    it('should reject payload with invalid scope value', () => {
      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        scope: 'invalid_scope',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });

    it('should reject payload with additional properties', () => {
      const payload = {
        entityId: 'entity-123',
        partId: 'part-456',
        scope: 'part',
        timestamp: Date.now(),
        unknownProperty: 'should fail',
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.keyword === 'additionalProperties')
      ).toBe(true);
    });
  });

  describe('anatomy:poisoned_stopped event validation', () => {
    let schema;

    beforeAll(() => {
      const eventDefinition = JSON.parse(
        fs.readFileSync(
          path.join(ANATOMY_EVENTS_DIR, 'poisoned_stopped.event.json'),
          'utf-8'
        )
      );
      schema = eventDefinition.payloadSchema;
    });

    it('should accept payload with scope="part" and partId', () => {
      // This is the payload structure sent by poisonTickSystem.js for part-scoped poison stop
      const payload = {
        partId: 'part-456',
        scope: 'part',
        reason: 'duration_expired',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept payload with scope="entity" and entityId', () => {
      // This is the payload structure sent by poisonTickSystem.js for entity-scoped poison stop
      const payload = {
        entityId: 'entity-123',
        scope: 'entity',
        reason: 'cured',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept all valid reason enum values', () => {
      const validReasons = ['duration_expired', 'cured', 'part_destroyed'];

      for (const reason of validReasons) {
        const payload = {
          partId: 'part-456',
          scope: 'part',
          reason,
          timestamp: Date.now(),
        };

        const validate = ajv.compile(schema);
        const valid = validate(payload);

        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      }
    });

    it('should reject payload missing required scope', () => {
      const payload = {
        partId: 'part-456',
        reason: 'duration_expired',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'scope'
        )
      ).toBe(true);
    });

    it('should reject payload missing required reason', () => {
      const payload = {
        partId: 'part-456',
        scope: 'part',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'reason'
        )
      ).toBe(true);
    });

    it('should reject payload missing required timestamp', () => {
      const payload = {
        partId: 'part-456',
        scope: 'part',
        reason: 'duration_expired',
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'timestamp'
        )
      ).toBe(true);
    });

    it('should reject payload with invalid scope value', () => {
      const payload = {
        partId: 'part-456',
        scope: 'invalid_scope',
        reason: 'duration_expired',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });

    it('should reject payload with invalid reason value', () => {
      const payload = {
        partId: 'part-456',
        scope: 'part',
        reason: 'invalid_reason',
        timestamp: Date.now(),
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });

    it('should reject payload with additional properties', () => {
      const payload = {
        partId: 'part-456',
        scope: 'part',
        reason: 'duration_expired',
        timestamp: Date.now(),
        unknownProperty: 'should fail',
      };

      const validate = ajv.compile(schema);
      const valid = validate(payload);

      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.keyword === 'additionalProperties')
      ).toBe(true);
    });
  });
});
