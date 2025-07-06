import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('System Error Event Payload Validation', () => {
  let ajv;
  let systemErrorSchema;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Schema from core:system_error_occurred event
    systemErrorSchema = {
      title: 'Core: System Error Occurred Event Payload',
      description:
        "Defines the payload structure for the 'core:system_error_occurred' event, used for reporting general system‐level errors.",
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Required. A user‐facing message describing the error.',
        },
        details: {
          type: 'object',
          description:
            'Optional. Additional technical details about the error.',
          properties: {
            statusCode: {
              type: 'integer',
              description:
                'Optional. Numeric code (e.g., HTTP status) associated with the error.',
            },
            url: {
              type: 'string',
              description: 'Optional. URI related to the error, if applicable.',
            },
            raw: {
              type: 'string',
              description: 'Optional. Raw error text or payload for debugging.',
            },
            stack: {
              type: 'string',
              description: 'Optional. Stack trace string for debugging.',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description:
                'Optional. ISO 8601 timestamp of when the error occurred.',
            },
            scopeName: {
              type: 'string',
              description:
                'Optional. Name of the scope that caused the error, if applicable.',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['message'],
      additionalProperties: false,
    };
  });

  describe('valid payloads', () => {
    it('should validate minimal payload with only message', () => {
      const payload = {
        message: 'A system error occurred',
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate payload with message and valid details', () => {
      const payload = {
        message: 'Runtime validation failed for component',
        details: {
          raw: JSON.stringify({
            modId: 'anatomy',
            filename: 'humanoid_arm.entity.json',
            entityId: 'anatomy:humanoid_arm',
            componentId: 'anatomy:sockets',
          }),
          timestamp: '2024-01-01T12:00:00Z',
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate payload with all allowed detail properties', () => {
      const payload = {
        message: 'System error with all details',
        details: {
          statusCode: 500,
          url: 'https://example.com/api',
          raw: 'Raw error data',
          stack: 'Error stack trace',
          timestamp: '2024-01-01T12:00:00Z',
          scopeName: 'testScope',
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('invalid payloads', () => {
    it('should reject payload without required message', () => {
      const payload = {
        details: {
          raw: 'Some error data',
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].keyword).toBe('required');
      expect(validate.errors[0].params.missingProperty).toBe('message');
    });

    it('should reject payload with additional properties in root', () => {
      const payload = {
        message: 'Error message',
        extraProperty: 'not allowed',
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].keyword).toBe('additionalProperties');
      expect(validate.errors[0].params.additionalProperty).toBe(
        'extraProperty'
      );
    });

    it('should reject payload with additional properties in details', () => {
      const payload = {
        message: 'Error message',
        details: {
          raw: 'Error data',
          componentId: 'anatomy:sockets', // Not allowed
          entityId: 'anatomy:humanoid_arm', // Not allowed
          errors: [], // Not allowed
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(false);
      expect(validate.errors.length).toBeGreaterThan(0);
      expect(
        validate.errors.every(
          (error) => error.keyword === 'additionalProperties'
        )
      ).toBe(true);

      const additionalProps = validate.errors.map(
        (error) => error.params.additionalProperty
      );
      expect(additionalProps).toContain('componentId');
      expect(additionalProps).toContain('entityId');
      expect(additionalProps).toContain('errors');
    });

    it('should reject payload with invalid timestamp format', () => {
      const payload = {
        message: 'Error message',
        details: {
          timestamp: 'not-a-valid-timestamp',
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].keyword).toBe('format');
      expect(validate.errors[0].params.format).toBe('date-time');
    });
  });

  describe('entityDefinitionLoader payload format', () => {
    it('should validate payload format used by entityDefinitionLoader', () => {
      // This is the format now used by entityDefinitionLoader after our fix
      const payload = {
        message:
          "Runtime component validation failed for entity 'anatomy:humanoid_arm' in file 'humanoid_arm.entity.json' (mod: anatomy). Invalid components: [anatomy:sockets]. See previous logs for details.",
        details: {
          raw: JSON.stringify({
            modId: 'anatomy',
            filename: 'humanoid_arm.entity.json',
            entityId: 'anatomy:humanoid_arm',
            failedComponentIds: 'anatomy:sockets',
          }),
        },
      };

      const validate = ajv.compile(systemErrorSchema);
      const isValid = validate(payload);

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });
});
