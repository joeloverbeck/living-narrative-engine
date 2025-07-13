/**
 * @file contract-request-validation.test.js
 * @description Contract tests for request validation against PROXY_API_CONTRACT.md Section 1.2
 */

import { describe, test, expect } from '@jest/globals';
import {
  contractValidator,
  contractMatchers,
} from './contract-validation-utils.js';

// Add custom matchers
expect.extend(contractMatchers);

describe('Contract Request Validation Tests', () => {
  test('contract validator is properly initialized', () => {
    // Verify contract validator is properly initialized
    const schemaInfo = contractValidator.getSchemaInfo();
    expect(schemaInfo.requestSchema.id).toBe('llm-proxy-request-schema');
    expect(schemaInfo.requestSchema.required).toEqual([
      'llmId',
      'targetPayload',
    ]);
  });

  describe('Valid Request Formats (Section 1.2)', () => {
    test('should accept minimal valid request with required fields only', () => {
      const validRequest = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      expect(validRequest).toMatchRequestContract();

      const result = contractValidator.validateRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept complete request with all optional fields', () => {
      const completeRequest = {
        llmId: 'openrouter-claude3-haiku-json-schema',
        targetPayload: {
          model: 'anthropic/claude-3-haiku-20240307',
          messages: [
            {
              role: 'user',
              content: 'Generate a description for a fantasy character.',
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'character_description',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
        },
        targetHeaders: {
          'HTTP-Referer': 'https://yourgame.com',
          'X-Title': 'My Awesome Text Adventure',
        },
      };

      expect(completeRequest).toMatchRequestContract();

      const result = contractValidator.validateRequest(completeRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept request with complex targetPayload variations', () => {
      const complexPayloads = [
        // OpenAI function calling
        {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'What is the weather?' }],
          functions: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          ],
        },
        // Anthropic tools
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 200,
          messages: [{ role: 'user', content: 'Calculate 15 + 27' }],
          tools: [
            {
              name: 'calculator',
              description: 'Perform arithmetic',
              input_schema: {
                type: 'object',
                properties: {
                  operation: { type: 'string' },
                  a: { type: 'number' },
                  b: { type: 'number' },
                },
                required: ['operation', 'a', 'b'],
              },
            },
          ],
        },
        // Simple completion
        {
          model: 'text-davinci-003',
          prompt: 'Complete this story:',
          max_tokens: 100,
          temperature: 0.8,
        },
      ];

      complexPayloads.forEach((payload, index) => {
        const request = {
          llmId: `complex-test-${index}`,
          targetPayload: payload,
        };

        expect(request).toMatchRequestContract();
      });
    });

    test('should accept various targetHeaders formats', () => {
      const headerVariations = [
        {}, // Empty headers
        { 'X-Custom': 'value' }, // Single header
        {
          'anthropic-version': '2023-06-01',
          'X-Title': 'My Game',
          'HTTP-Referer': 'https://example.com',
          'X-Custom-Header': 'custom-value',
        }, // Multiple headers
        {
          'Content-Language': 'en-US',
          'X-Request-ID': 'req-123456',
        }, // Different header types
      ];

      headerVariations.forEach((headers, index) => {
        const request = {
          llmId: `headers-test-${index}`,
          targetPayload: { model: 'test-model', prompt: 'test' },
          targetHeaders: headers,
        };

        expect(request).toMatchRequestContract();
      });
    });

    test('should accept various llmId formats', () => {
      const validLlmIds = [
        'simple',
        'openai-gpt-4',
        'anthropic-claude3-haiku',
        'openrouter-claude3-haiku-json-schema',
        'local-ollama-llama2',
        'provider_model_config',
        'test-llm-123',
        'very_long_llm_identifier_with_underscores_and_dashes',
      ];

      validLlmIds.forEach((llmId) => {
        const request = {
          llmId,
          targetPayload: {
            model: 'test',
            messages: [{ role: 'user', content: 'test' }],
          },
        };

        expect(request).toMatchRequestContract();
      });
    });
  });

  describe('Invalid Request Formats (Schema Violations)', () => {
    test('should reject request missing required llmId field', () => {
      const invalidRequest = {
        // Missing llmId
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      expect(invalidRequest).not.toMatchRequestContract();

      const result = contractValidator.validateRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            message: 'Missing required property: llmId',
          }),
        ])
      );
    });

    test('should reject request missing required targetPayload field', () => {
      const invalidRequest = {
        llmId: 'test-llm',
        // Missing targetPayload
      };

      expect(invalidRequest).not.toMatchRequestContract();

      const result = contractValidator.validateRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            message: 'Missing required property: targetPayload',
          }),
        ])
      );
    });

    test('should reject request with invalid llmId type', () => {
      const invalidRequests = [
        {
          llmId: 123, // Number instead of string
          targetPayload: { model: 'test' },
        },
        {
          llmId: null, // Null instead of string
          targetPayload: { model: 'test' },
        },
        {
          llmId: ['array'], // Array instead of string
          targetPayload: { model: 'test' },
        },
        {
          llmId: { object: true }, // Object instead of string
          targetPayload: { model: 'test' },
        },
      ];

      invalidRequests.forEach((request) => {
        expect(request).not.toMatchRequestContract();

        const result = contractValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.formattedErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              keyword: 'type',
              message: expect.stringContaining('must be string'),
            }),
          ])
        );
      });
    });

    test('should reject request with invalid targetPayload type', () => {
      const invalidRequests = [
        {
          llmId: 'test-llm',
          targetPayload: 'string', // String instead of object
        },
        {
          llmId: 'test-llm',
          targetPayload: 123, // Number instead of object
        },
        {
          llmId: 'test-llm',
          targetPayload: null, // Null instead of object
        },
        {
          llmId: 'test-llm',
          targetPayload: [], // Array instead of object
        },
      ];

      invalidRequests.forEach((request) => {
        expect(request).not.toMatchRequestContract();

        const result = contractValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.formattedErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              keyword: 'type',
              message: expect.stringContaining('must be object'),
            }),
          ])
        );
      });
    });

    test('should reject request with empty targetPayload', () => {
      const invalidRequest = {
        llmId: 'test-llm',
        targetPayload: {}, // Empty object
      };

      expect(invalidRequest).not.toMatchRequestContract();

      const result = contractValidator.validateRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minProperties',
            message: expect.stringContaining(
              'must NOT have fewer than 1 properties'
            ),
          }),
        ])
      );
    });

    test('should reject request with invalid targetHeaders type', () => {
      const invalidRequests = [
        {
          llmId: 'test-llm',
          targetPayload: { model: 'test' },
          targetHeaders: 'string', // String instead of object
        },
        {
          llmId: 'test-llm',
          targetPayload: { model: 'test' },
          targetHeaders: 123, // Number instead of object
        },
        {
          llmId: 'test-llm',
          targetPayload: { model: 'test' },
          targetHeaders: [], // Array instead of object
        },
      ];

      invalidRequests.forEach((request) => {
        expect(request).not.toMatchRequestContract();

        const result = contractValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.formattedErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              keyword: 'type',
              message: expect.stringContaining('must be object'),
            }),
          ])
        );
      });
    });

    test('should reject request with invalid llmId format', () => {
      const invalidLlmIds = [
        '', // Empty string
        ' ', // Whitespace only
        'invalid spaces', // Contains spaces
        'invalid@symbols', // Contains invalid symbols
        'invalid.periods', // Contains periods
        'invalid/slashes', // Contains slashes
      ];

      invalidLlmIds.forEach((llmId) => {
        const request = {
          llmId,
          targetPayload: { model: 'test' },
        };

        expect(request).not.toMatchRequestContract();

        const result = contractValidator.validateRequest(request);
        expect(result.isValid).toBe(false);
      });
    });

    test('should reject request with additional properties', () => {
      const invalidRequest = {
        llmId: 'test-llm',
        targetPayload: { model: 'test' },
        targetHeaders: { 'X-Test': 'value' },
        unexpectedField: 'not allowed', // Additional property
      };

      expect(invalidRequest).not.toMatchRequestContract();

      const result = contractValidator.validateRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
            message: expect.stringContaining(
              "additional property 'unexpectedField' is not allowed"
            ),
          }),
        ])
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle very large targetPayload objects', () => {
      const largePayload = {
        model: 'gpt-4',
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(1000)}`, // 1000 char content
        })),
        temperature: 0.7,
        max_tokens: 4000,
        metadata: {
          description: 'Large payload test',
          data: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            value: `item-${i}`,
          })),
        },
      };

      const request = {
        llmId: 'large-payload-test',
        targetPayload: largePayload,
      };

      expect(request).toMatchRequestContract();
    });

    test('should handle complex nested targetPayload structures', () => {
      const nestedPayload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image',
              },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
                  detail: 'high',
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'complex_analysis',
              description: 'Perform complex analysis',
              parameters: {
                type: 'object',
                properties: {
                  analysis_type: {
                    type: 'string',
                    enum: ['visual', 'textual', 'combined'],
                  },
                  options: {
                    type: 'object',
                    properties: {
                      detail_level: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 10,
                      },
                      include_metadata: { type: 'boolean' },
                      output_format: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          schema: { type: 'object' },
                        },
                      },
                    },
                  },
                },
                required: ['analysis_type'],
              },
            },
          },
        ],
      };

      const request = {
        llmId: 'nested-payload-test',
        targetPayload: nestedPayload,
      };

      expect(request).toMatchRequestContract();
    });

    test('should handle Unicode and special characters in strings', () => {
      const unicodeRequest = {
        llmId: 'unicode-test',
        targetPayload: {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content:
                'Hello in different languages: 🌍 中文 العربية русский 日本語 emoji: 🎮🎯🔥',
            },
          ],
        },
        targetHeaders: {
          'X-Language': 'multi-unicode',
          'X-Emoji': '🚀🌟💫',
          'X-Special-Chars': 'áéíóú ñ ç ß π ∞ ≠ ∑',
        },
      };

      expect(unicodeRequest).toMatchRequestContract();
    });

    test('should validate boundary values for string lengths', () => {
      // Test minimum valid llmId
      const minRequest = {
        llmId: 'a', // Single character
        targetPayload: { m: 'v' }, // Minimal payload
      };

      expect(minRequest).toMatchRequestContract();

      // Test very long llmId (should still be valid)
      const longLlmId = 'a'.repeat(100);
      const longRequest = {
        llmId: longLlmId,
        targetPayload: { model: 'test' },
      };

      expect(longRequest).toMatchRequestContract();
    });
  });

  describe('Contract Schema Information', () => {
    test('should provide correct schema metadata', () => {
      const schemaInfo = contractValidator.getSchemaInfo();

      expect(schemaInfo.requestSchema).toEqual({
        id: 'llm-proxy-request-schema',
        title: 'LLM Proxy Server Request Schema',
        required: ['llmId', 'targetPayload'],
      });
    });

    test('should validate schema examples from contract', () => {
      // Example from PROXY_API_CONTRACT.md
      const contractExample = {
        llmId: 'openrouter-claude3-haiku-json-schema',
        targetPayload: {
          model: 'anthropic/claude-3-haiku-20240307',
          messages: [
            {
              role: 'user',
              content: 'Generate a description for a fantasy character.',
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'character_description',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
        },
        targetHeaders: {
          'HTTP-Referer': 'https://yourgame.com',
          'X-Title': 'My Awesome Text Adventure',
        },
      };

      expect(contractExample).toMatchRequestContract();

      // Validate using assertValidRequest method
      expect(() => {
        contractValidator.assertValidRequest(
          contractExample,
          'Contract example validation'
        );
      }).not.toThrow();
    });
  });
});
