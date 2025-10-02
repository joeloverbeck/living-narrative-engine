/**
 * @file contract-regression.test.js
 * @description Contract regression tests to detect breaking changes and ensure backward compatibility
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  contractValidator,
  contractMatchers,
} from './contract-validation-utils.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Add custom matchers
expect.extend(contractMatchers);

describe('Contract Regression Tests', () => {
  let schemaBaselines;

  beforeAll(() => {
    // Establish schema baselines for regression testing
    schemaBaselines = {
      requestSchema: {
        requiredFields: ['llmId', 'targetPayload'],
        optionalFields: ['targetHeaders'],
        llmIdPattern: '^[a-zA-Z0-9_.-]+$',
        additionalPropertiesAllowed: false,
      },
      errorResponseSchema: {
        requiredFields: ['error', 'message', 'originalStatusCode'],
        optionalFields: ['stage', 'details'],
        stageEnumCount: 15,
        statusCodeRange: { min: 100, max: 599 },
        additionalPropertiesAllowed: false,
      },
    };
  });

  describe('Schema Structure Regression Tests', () => {
    test('should maintain required fields in request schema', () => {
      const schemaInfo = contractValidator.getSchemaInfo();

      expect(schemaInfo.requestSchema.required).toEqual(
        expect.arrayContaining(schemaBaselines.requestSchema.requiredFields)
      );

      // Should not have gained or lost required fields
      expect(schemaInfo.requestSchema.required).toHaveLength(
        schemaBaselines.requestSchema.requiredFields.length
      );
    });

    test('should maintain required fields in error response schema', () => {
      const schemaInfo = contractValidator.getSchemaInfo();

      expect(schemaInfo.errorResponseSchema.required).toEqual(
        expect.arrayContaining(
          schemaBaselines.errorResponseSchema.requiredFields
        )
      );

      // Should not have gained or lost required fields
      expect(schemaInfo.errorResponseSchema.required).toHaveLength(
        schemaBaselines.errorResponseSchema.requiredFields.length
      );
    });

    test('should maintain stage enum values without removing existing ones', () => {
      const schemaInfo = contractValidator.getSchemaInfo();
      const currentStages = schemaInfo.errorResponseSchema.stageEnum;

      // Current implementation should have all baseline stages
      const baselineStages = [
        'request_validation',
        'llm_config_lookup_error',
        'api_key_retrieval_error',
        'llm_endpoint_resolution_error',
        'llm_forwarding_error_network',
        'llm_forwarding_error_http_client',
        'llm_forwarding_error_http_server',
        'internal_proxy_error',
        'initialization_failure',
      ];

      baselineStages.forEach((stage) => {
        expect(currentStages).toContain(stage);
      });

      // Can have more stages but not fewer
      expect(currentStages.length).toBeGreaterThanOrEqual(
        baselineStages.length
      );
    });

    test('should maintain backward compatibility for all documented examples', () => {
      // Test examples that must continue to work
      const backwardCompatibilityExamples = [
        // Request examples
        {
          type: 'request',
          description: 'Minimal valid request',
          data: {
            llmId: 'test-llm',
            targetPayload: {
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'Hello' }],
            },
          },
        },
        {
          type: 'request',
          description: 'Complete request with all fields',
          data: {
            llmId: 'openrouter-claude3-haiku',
            targetPayload: {
              model: 'anthropic/claude-3-haiku-20240307',
              messages: [{ role: 'user', content: 'Test' }],
              temperature: 0.7,
              max_tokens: 150,
            },
            targetHeaders: {
              'HTTP-Referer': 'https://example.com',
              'X-Title': 'Test App',
            },
          },
        },
        // Error response examples
        {
          type: 'errorResponse',
          description: 'Minimal error response',
          data: {
            error: true,
            message: 'An error occurred',
            originalStatusCode: 500,
          },
        },
        {
          type: 'errorResponse',
          description: 'Complete error response',
          data: {
            error: true,
            message: 'Request validation failed',
            stage: 'request_validation',
            details: {
              missingFields: ['llmId'],
            },
            originalStatusCode: 400,
          },
        },
      ];

      backwardCompatibilityExamples.forEach((example) => {
        // Test each example based on its type
        const matcher =
          example.type === 'request'
            ? 'toMatchRequestContract'
            : 'toMatchErrorResponseContract';
        expect(example.data)[matcher]();
      });
    });
  });

  describe('Breaking Change Detection', () => {
    test('should detect if required fields are removed from request schema', () => {
      // This test would fail if someone removes required fields
      const testRequiredFields = ['llmId', 'targetPayload'];

      testRequiredFields.forEach((field) => {
        const testRequest = {
          llmId: 'test',
          targetPayload: { model: 'test' },
        };

        // Remove the field we're testing
        delete testRequest[field];

        // Should be invalid without required field
        const result = contractValidator.validateRequest(testRequest);
        expect(result.isValid).toBe(false);
        expect(result.formattedErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              keyword: 'required',
              message: `Missing required property: ${field}`,
            }),
          ])
        );
      });
    });

    test('should detect if required fields are removed from error response schema', () => {
      const testRequiredFields = ['error', 'message', 'originalStatusCode'];

      testRequiredFields.forEach((field) => {
        const testErrorResponse = {
          error: true,
          message: 'Test error',
          originalStatusCode: 500,
        };

        // Remove the field we're testing
        delete testErrorResponse[field];

        // Should be invalid without required field
        const result =
          contractValidator.validateErrorResponse(testErrorResponse);
        expect(result.isValid).toBe(false);
        expect(result.formattedErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              keyword: 'required',
              message: `Missing required property: ${field}`,
            }),
          ])
        );
      });
    });

    test('should detect if stage enum values are removed', () => {
      // Test that all documented stage values still work
      const documentedStages = [
        'request_validation',
        'llm_config_lookup_error',
        'api_key_retrieval_error',
        'llm_endpoint_resolution_error',
        'llm_forwarding_error_network',
        'llm_forwarding_error_http_client',
        'llm_forwarding_error_http_server',
        'internal_proxy_error',
        'initialization_failure',
      ];

      documentedStages.forEach((stage) => {
        const errorResponse = {
          error: true,
          message: `Test error for stage: ${stage}`,
          stage: stage,
          originalStatusCode: 500,
        };

        expect(errorResponse).toMatchErrorResponseContract();
      });
    });

    test('should detect if data type requirements change', () => {
      // Test that current type requirements are maintained
      const typeTests = [
        {
          description: 'llmId must be string',
          request: { llmId: 123, targetPayload: { model: 'test' } },
          shouldBeValid: false,
        },
        {
          description: 'targetPayload must be object',
          request: { llmId: 'test', targetPayload: 'string' },
          shouldBeValid: false,
        },
        {
          description: 'error must be boolean true',
          errorResponse: {
            error: 'true',
            message: 'test',
            originalStatusCode: 500,
          },
          shouldBeValid: false,
        },
        {
          description: 'originalStatusCode must be number',
          errorResponse: {
            error: true,
            message: 'test',
            originalStatusCode: '500',
          },
          shouldBeValid: false,
        },
      ];

      typeTests.forEach((testCase) => {
        // Test each case separately
        const dataToTest = testCase.request || testCase.errorResponse;
        const validatorMethod = testCase.request
          ? 'validateRequest'
          : 'validateErrorResponse';

        const result = contractValidator[validatorMethod](dataToTest);
        expect(result.isValid).toBe(testCase.shouldBeValid);
      });
    });

    test('should detect if additional properties restrictions change', () => {
      // Test that additional properties are still not allowed
      const requestWithExtra = {
        llmId: 'test',
        targetPayload: { model: 'test' },
        extraField: 'not allowed',
      };

      expect(requestWithExtra).not.toMatchRequestContract();

      const errorWithExtra = {
        error: true,
        message: 'test',
        originalStatusCode: 500,
        extraField: 'not allowed',
      };

      expect(errorWithExtra).not.toMatchErrorResponseContract();
    });
  });

  describe('Schema Version Compatibility', () => {
    test('should maintain JSON Schema draft-07 compatibility', () => {
      // Load the actual schema files and verify they're still draft-07
      const requestSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'request-schema.json'
      );
      const errorResponseSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'error-response-schema.json'
      );

      const requestSchema = JSON.parse(readFileSync(requestSchemaPath, 'utf8'));
      const errorResponseSchema = JSON.parse(
        readFileSync(errorResponseSchemaPath, 'utf8')
      );

      expect(requestSchema.$schema).toBe(
        'http://json-schema.org/draft-07/schema#'
      );
      expect(errorResponseSchema.$schema).toBe(
        'http://json-schema.org/draft-07/schema#'
      );
    });

    test('should maintain schema IDs for tooling compatibility', () => {
      const requestSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'request-schema.json'
      );
      const errorResponseSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'error-response-schema.json'
      );

      const requestSchema = JSON.parse(readFileSync(requestSchemaPath, 'utf8'));
      const errorResponseSchema = JSON.parse(
        readFileSync(errorResponseSchemaPath, 'utf8')
      );

      expect(requestSchema.$id).toBe('llm-proxy-request-schema');
      expect(errorResponseSchema.$id).toBe('llm-proxy-error-response-schema');
    });

    test('should maintain consistent schema titles and descriptions', () => {
      const schemaInfo = contractValidator.getSchemaInfo();

      expect(schemaInfo.requestSchema.title).toBe(
        'LLM Proxy Server Request Schema'
      );
      expect(schemaInfo.errorResponseSchema.title).toBe(
        'LLM Proxy Server Error Response Schema'
      );
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain fast validation performance', async () => {
      const testRequest = {
        llmId: 'performance-test',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Performance test' }],
        },
      };

      const testErrorResponse = {
        error: true,
        message: 'Performance test error',
        originalStatusCode: 500,
      };

      // Warm up validators
      contractValidator.validateRequest(testRequest);
      contractValidator.validateErrorResponse(testErrorResponse);

      // Measure validation performance
      const iterations = 1000;

      const requestStart = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        contractValidator.validateRequest(testRequest);
      }
      const requestEnd = process.hrtime.bigint();
      const requestTime = Number(requestEnd - requestStart) / 1000000; // Convert to ms

      const errorStart = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        contractValidator.validateErrorResponse(testErrorResponse);
      }
      const errorEnd = process.hrtime.bigint();
      const errorTime = Number(errorEnd - errorStart) / 1000000; // Convert to ms

      // Performance baselines (per 1000 validations)
      expect(requestTime).toBeLessThan(100); // Under 100ms for 1000 request validations
      expect(errorTime).toBeLessThan(50); // Under 50ms for 1000 error response validations

      // Log performance for monitoring
      console.log(
        `Performance: ${iterations} request validations: ${requestTime.toFixed(2)}ms`
      );
      console.log(
        `Performance: ${iterations} error validations: ${errorTime.toFixed(2)}ms`
      );
    });

    test('should handle large payloads without performance degradation', () => {
      // Create a large but valid payload
      const largePayload = {
        model: 'gpt-4',
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(1000)}`,
        })),
        metadata: {
          data: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: `item-${i}`,
          })),
        },
      };

      const largeRequest = {
        llmId: 'large-payload-test',
        targetPayload: largePayload,
      };

      const start = process.hrtime.bigint();
      const result = contractValidator.validateRequest(largeRequest);
      const end = process.hrtime.bigint();
      const time = Number(end - start) / 1000000;

      expect(result.isValid).toBe(true);
      expect(time).toBeLessThan(50); // Under 50ms for large payload validation

      console.log(`Large payload validation time: ${time.toFixed(2)}ms`);
    });
  });

  describe('Contract Documentation Compliance', () => {
    test('should validate all examples from PROXY_API_CONTRACT.md', () => {
      // These are the exact examples from the contract document
      const contractDocumentExamples = {
        requestExample: {
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
        },
        errorExamples: [
          {
            error: true,
            message: 'Client request validation failed.',
            stage: 'request_validation',
            details: {
              missingFields: ['targetPayload'],
              invalidFields: [
                {
                  field: 'llmId',
                  value: 123,
                  reason: 'Must be a string.',
                },
              ],
            },
            originalStatusCode: 400,
          },
          {
            error: true,
            message:
              'Failed to retrieve API key for the specified LLM provider.',
            stage: 'api_key_retrieval_error',
            details: {
              llmId: 'some-cloud-llm',
              reason:
                "The environment variable 'EXPECTED_API_KEY_ENV_VAR' is not set on the proxy server.",
            },
            originalStatusCode: 500,
          },
          {
            error: true,
            message:
              'Network error occurred while attempting to forward request to the LLM provider.',
            stage: 'llm_forwarding_error_network',
            details: {
              llmId: 'another-cloud-llm',
              targetUrl: 'https://api.llmprovider.com/v1/chat/completions',
              errorFromFetch: 'ECONNREFUSED',
            },
            originalStatusCode: 502,
          },
          {
            error: true,
            message:
              "The LLM provider returned an error: Invalid 'model' parameter.",
            stage: 'llm_forwarding_error_http_client',
            details: {
              llmId: 'openai-gpt-4o',
              llmApiStatusCode: 400,
              llmApiResponseBody: {
                error: {
                  message:
                    "Invalid 'model' parameter. Please check the model name.",
                  type: 'invalid_request_error',
                  param: 'model',
                  code: null,
                },
              },
            },
            originalStatusCode: 400,
          },
        ],
      };

      // Test request example
      expect(contractDocumentExamples.requestExample).toMatchRequestContract();

      // Test all error examples
      contractDocumentExamples.errorExamples.forEach((errorExample) => {
        expect(errorExample).toMatchErrorResponseContract();
        expect(errorExample).toMeetSecurityRequirements();
      });
    });

    test('should maintain consistency with documented stage meanings', () => {
      // Verify that stage-to-status-code mappings remain consistent
      const stageDocumentation = [
        {
          stage: 'request_validation',
          description: 'Client request malformed or missing required fields',
          expectedStatusCodes: [400],
        },
        {
          stage: 'llm_config_lookup_error',
          description: 'Proxy could not find configuration for llmId',
          expectedStatusCodes: [400, 404],
        },
        {
          stage: 'api_key_retrieval_error',
          description: 'Proxy failed to retrieve necessary API key',
          expectedStatusCodes: [500, 401, 403],
        },
        {
          stage: 'llm_forwarding_error_network',
          description: 'Network issue connecting to LLM provider',
          expectedStatusCodes: [502],
        },
        {
          stage: 'llm_forwarding_error_http_client',
          description: 'LLM provider returned 4xx error',
          expectedStatusCodes: [400, 401, 403, 404, 429],
        },
        {
          stage: 'llm_forwarding_error_http_server',
          description: 'LLM provider returned 5xx error',
          expectedStatusCodes: [502, 503],
        },
        {
          stage: 'internal_proxy_error',
          description: 'Unexpected server-side error in proxy',
          expectedStatusCodes: [500],
        },
        {
          stage: 'initialization_failure',
          description: 'Proxy initialization or startup failure',
          expectedStatusCodes: [503],
        },
      ];

      stageDocumentation.forEach(({ stage, expectedStatusCodes }) => {
        expectedStatusCodes.forEach((statusCode) => {
          const validation = contractValidator.validateStatusCodeForStage(
            statusCode,
            stage
          );
          expect(validation.isValid).toBe(true);
        });
      });
    });
  });

  describe('Future Compatibility', () => {
    test('should allow new optional fields without breaking existing contracts', () => {
      // This test ensures that adding new optional fields won't break existing clients

      // Simulate a future schema that might add optional fields
      const futureRequestWithNewOptionalField = {
        llmId: 'future-test',
        targetPayload: { model: 'future-model' },
        targetHeaders: { 'X-Future': 'optional' },
        // If a new optional field were added, existing contracts should still work
        // futureOptionalField: 'new-feature'
      };

      const futureErrorResponseWithNewOptionalField = {
        error: true,
        message: 'Future error',
        stage: 'request_validation',
        details: { reason: 'future-details' },
        originalStatusCode: 400,
        // If a new optional field were added, existing contracts should still work
        // futureOptionalField: 'new-error-feature'
      };

      // Current contracts should still validate
      expect(futureRequestWithNewOptionalField).toMatchRequestContract();
      expect(
        futureErrorResponseWithNewOptionalField
      ).toMatchErrorResponseContract();
    });

    test('should maintain extensibility in details objects', () => {
      // The details object should remain extensible for future error information
      const extensibleErrorResponse = {
        error: true,
        message: 'Extensible error details test',
        stage: 'api_key_retrieval_error',
        details: {
          // Current fields
          llmId: 'test-llm',
          reason: 'Standard reason',
          // Future extensions could add more fields here
          diagnosticId: 'future-diagnostic-123',
          retryCount: 3,
          lastAttempt: '2024-01-01T00:00:00Z',
          customMetadata: {
            source: 'future-feature',
            version: '2.0.0',
          },
        },
        originalStatusCode: 500,
      };

      expect(extensibleErrorResponse).toMatchErrorResponseContract();
      expect(extensibleErrorResponse).toMeetSecurityRequirements();
    });

    test('should support new stage enum values for future error types', () => {
      // While existing stages must remain, new stages should be addable
      const currentStages = contractValidator.getValidStages();

      // Verify minimum required stages exist
      const requiredStages = [
        'request_validation',
        'llm_config_lookup_error',
        'api_key_retrieval_error',
        'llm_forwarding_error_network',
        'llm_forwarding_error_http_client',
        'llm_forwarding_error_http_server',
        'internal_proxy_error',
      ];

      requiredStages.forEach((stage) => {
        expect(currentStages).toContain(stage);
      });

      // Current implementation has extended stages - this is allowed
      expect(currentStages.length).toBeGreaterThanOrEqual(
        requiredStages.length
      );
    });
  });
});
