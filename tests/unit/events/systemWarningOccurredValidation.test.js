import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('system_warning_occurred event validation', () => {
  let ajv;
  let validate;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Define the schema directly from system_warning_occurred.event.json
    const schema = {
      title: 'Core: System Warning Occurred Event Payload',
      description: "Defines the payload structure for the 'core:system_warning_occurred' event, used for reporting general system‐level warnings.",
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Required. A user‐facing message describing the warning.',
        },
        details: {
          type: 'object',
          description: 'Optional. Additional technical details about the warning.',
          properties: {
            statusCode: {
              type: 'integer',
              description: 'Optional. Numeric code (e.g., HTTP status) associated with the warning.',
            },
            url: {
              type: 'string',
              description: 'Optional. URI related to the warning, if applicable.',
            },
            raw: {
              type: 'string',
              description: 'Optional. Raw diagnostic text or payload for debugging.',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Optional. ISO 8601 timestamp of when the warning occurred.',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['message'],
      additionalProperties: false,
    };

    validate = ajv.compile(schema);
  });

  describe('payload structure validation', () => {
    it('should accept valid payload with only required message field', () => {
      const payload = {
        message: 'A warning occurred',
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept valid payload with all optional fields', () => {
      const payload = {
        message: 'A warning occurred',
        details: {
          statusCode: 504,
          url: 'http://example.com',
          raw: 'Error details as string',
          timestamp: new Date().toISOString(),
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject payload with missing message', () => {
      const payload = {
        details: {
          statusCode: 504,
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === "must have required property 'message'")).toBe(true);
    });

    it('should reject payload with non-string message', () => {
      const payload = {
        message: 123,
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string')).toBe(true);
    });
  });

  describe('details.raw field validation', () => {
    it('should accept string raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: 'This is a string error message',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject object raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: {
            error: true,
            message: 'Complex error object',
            details: { nested: 'data' },
          },
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string' && err.instancePath === '/details/raw')).toBe(true);
    });

    it('should reject array raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: ['error1', 'error2'],
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string' && err.instancePath === '/details/raw')).toBe(true);
    });

    it('should reject number raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: 12345,
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string' && err.instancePath === '/details/raw')).toBe(true);
    });

    it('should reject boolean raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: true,
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string' && err.instancePath === '/details/raw')).toBe(true);
    });

    it('should accept empty string raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: '',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept very long string raw value', () => {
      const payload = {
        message: 'Warning',
        details: {
          raw: 'x'.repeat(1000),
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('details field validation', () => {
    it('should reject details with additional properties', () => {
      const payload = {
        message: 'Warning',
        details: {
          statusCode: 504,
          unknownField: 'should not be allowed',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must NOT have additional properties')).toBe(true);
    });

    it('should accept details with only statusCode', () => {
      const payload = {
        message: 'Warning',
        details: {
          statusCode: 404,
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept details with only url', () => {
      const payload = {
        message: 'Warning',
        details: {
          url: 'https://example.com/api',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept details with valid timestamp', () => {
      const payload = {
        message: 'Warning',
        details: {
          timestamp: '2025-07-20T18:31:38.573Z',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject details with invalid timestamp format', () => {
      const payload = {
        message: 'Warning',
        details: {
          timestamp: 'not-a-valid-date',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.keyword === 'format' && err.params.format === 'date-time')).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle proxy server 504 error payload after fix', () => {
      // This simulates what retryHttpClient will send after our fix
      const payload = {
        message: 'Retryable HTTP error 504 on http://localhost:3001/api/llm-request (attempt 1/4)',
        details: {
          statusCode: 504,
          url: 'http://localhost:3001/api/llm-request',
          raw: '{"error":true,"message":"The proxy encountered a network issue or exhausted retries when trying to reach the LLM provider.","stage":"llm_forwar',
          timestamp: '2025-07-20T18:31:38.573Z',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject the original problematic payload with object raw', () => {
      // This is the original payload that was causing the validation error
      const payload = {
        message: 'Retryable HTTP error 504 on http://localhost:3001/api/llm-request (attempt 1/4)',
        details: {
          statusCode: 504,
          url: 'http://localhost:3001/api/llm-request',
          raw: {
            error: true,
            message: 'The proxy encountered a network issue or exhausted retries when trying to reach the LLM provider.',
            stage: 'llm_forwarding_network_or_retry_exhausted',
            details: {
              llmId: 'openrouter-claude-sonnet-4-toolcalling',
              targetUrl: 'https://openrouter.ai/api/v1/chat/completions',
              originalErrorMessage: 'RetryManager: Failed for https://openrouter.ai/api/v1/chat/completions after 1 attempt(s). Unexpected error: fetch failed',
              originalProxiedErrorMessage: 'fetch failed',
            },
            originalStatusCode: 504,
          },
          timestamp: '2025-07-20T18:31:38.573Z',
        },
      };

      const isValid = validate(payload);
      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors.some(err => err.message === 'must be string' && err.instancePath === '/details/raw')).toBe(true);
    });
  });
});