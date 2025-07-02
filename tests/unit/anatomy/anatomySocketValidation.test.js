import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';

describe('Anatomy Socket Component Validation', () => {
  let ajv;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
  });

  describe('anatomy:sockets component validation', () => {
    it('should validate valid socket configuration', async () => {
      const socketSchema = {
        type: 'object',
        properties: {
          sockets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                orientation: {
                  type: 'string',
                  enum: ['left', 'right', 'mid', 'upper', 'lower', 'front', 'back']
                },
                allowedTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                },
                nameTpl: { type: 'string' }
              },
              required: ['id', 'allowedTypes'],
              additionalProperties: false
            }
          }
        },
        required: ['sockets'],
        additionalProperties: false
      };

      const validate = ajv.compile(socketSchema);

      const validSocketData = {
        sockets: [
          {
            id: 'wrist',
            orientation: 'lower',
            allowedTypes: ['hand'],
            nameTpl: '{{parent.name}} {{type}}'
          }
        ]
      };

      const isValid = validate(validSocketData);

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject socket configuration with maxCount property', async () => {
      const socketSchema = {
        type: 'object',
        properties: {
          sockets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                orientation: {
                  type: 'string',
                  enum: ['left', 'right', 'mid', 'upper', 'lower', 'front', 'back']
                },
                allowedTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                },
                nameTpl: { type: 'string' }
              },
              required: ['id', 'allowedTypes'],
              additionalProperties: false
            }
          }
        },
        required: ['sockets'],
        additionalProperties: false
      };

      const validate = ajv.compile(socketSchema);

      const invalidSocketData = {
        sockets: [
          {
            id: 'wrist',
            orientation: 'lower',
            allowedTypes: ['hand'],
            maxCount: 1, // This should be rejected
            nameTpl: '{{parent.name}} {{type}}'
          }
        ]
      };

      const isValid = validate(invalidSocketData);

      expect(isValid).toBe(false);
      expect(validate.errors).toHaveLength(1);
      expect(validate.errors[0].keyword).toBe('additionalProperties');
      expect(validate.errors[0].params.additionalProperty).toBe('maxCount');
    });

    it('should require id and allowedTypes properties', async () => {
      const socketSchema = {
        type: 'object',
        properties: {
          sockets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                allowedTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1
                }
              },
              required: ['id', 'allowedTypes'],
              additionalProperties: false
            }
          }
        },
        required: ['sockets'],
        additionalProperties: false
      };

      const validate = ajv.compile(socketSchema);

      const invalidSocketData = {
        sockets: [
          {
            orientation: 'lower',
            nameTpl: '{{parent.name}} {{type}}'
            // Missing required 'id' and 'allowedTypes'
          }
        ]
      };

      const isValid = validate(invalidSocketData);

      expect(isValid).toBe(false);
      expect(validate.errors.length).toBeGreaterThan(0);
      expect(validate.errors.some(error => error.keyword === 'required')).toBe(true);
    });
  });
});