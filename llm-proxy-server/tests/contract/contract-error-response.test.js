/**
 * @file contract-error-response.test.js
 * @description Contract tests for error response validation against PROXY_API_CONTRACT.md Section 2.1
 */

import { describe, test, expect } from '@jest/globals';
import {
  contractValidator,
  contractMatchers,
} from './contract-validation-utils.js';

// Add custom matchers
expect.extend(contractMatchers);

describe('Contract Error Response Validation Tests', () => {
  test('contract validator is properly initialized', () => {
    // Verify contract validator is properly initialized
    const schemaInfo = contractValidator.getSchemaInfo();
    expect(schemaInfo.errorResponseSchema.id).toBe(
      'llm-proxy-error-response-schema'
    );
    expect(schemaInfo.errorResponseSchema.required).toEqual([
      'error',
      'message',
      'originalStatusCode',
    ]);
  });

  describe('Valid Error Response Formats (Section 2.1)', () => {
    test('should accept minimal valid error response with required fields only', () => {
      const validErrorResponse = {
        error: true,
        message: 'A basic error occurred',
        originalStatusCode: 500,
      };

      expect(validErrorResponse).toMatchErrorResponseContract();

      const result =
        contractValidator.validateErrorResponse(validErrorResponse);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept complete error response with all optional fields', () => {
      const completeErrorResponse = {
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
      };

      expect(completeErrorResponse).toMatchErrorResponseContract();

      const result = contractValidator.validateErrorResponse(
        completeErrorResponse
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept all valid stage enum values', () => {
      const validStages = contractValidator.getValidStages();

      validStages.forEach((stage) => {
        const errorResponse = {
          error: true,
          message: `Error for stage: ${stage}`,
          stage: stage,
          originalStatusCode: 500,
        };

        expect(errorResponse).toMatchErrorResponseContract();
      });

      // Verify we have all expected stages
      expect(validStages).toEqual([
        'request_validation',
        'request_validation_llmid_missing',
        'request_validation_payload_missing',
        'llm_config_lookup_error',
        'llm_config_lookup_failed',
        'api_key_retrieval_error',
        'llm_endpoint_resolution_error',
        'llm_forwarding_error_network',
        'llm_forwarding_error_http_client',
        'llm_forwarding_error_http_server',
        'internal_proxy_error',
        'internal_api_key_service_state_error',
        'internal_llm_service_exception',
        'initialization_failure',
        'initialization_failure_unknown',
      ]);
    });

    test('should accept various HTTP status codes', () => {
      const validStatusCodes = [400, 401, 403, 404, 429, 500, 502, 503];

      validStatusCodes.forEach((statusCode) => {
        const errorResponse = {
          error: true,
          message: `Error with status ${statusCode}`,
          originalStatusCode: statusCode,
        };

        expect(errorResponse).toMatchErrorResponseContract();
      });
    });

    test('should accept complex details objects', () => {
      const complexDetailsVariations = [
        // Request validation details
        {
          missingFields: ['llmId', 'targetPayload'],
          invalidFields: [
            {
              field: 'targetHeaders',
              value: 'string',
              reason: 'Must be an object',
            },
          ],
          receivedRequest: {
            targetHeaders: 'invalid',
          },
        },
        // API key retrieval details
        {
          llmId: 'test-llm',
          reason: 'Environment variable not set',
          environmentVariable: 'OPENAI_API_KEY',
          configurationPath: '/etc/llm-proxy/config.json',
        },
        // Network error details
        {
          llmId: 'remote-llm',
          targetUrl: 'https://api.example.com/v1/chat',
          errorFromFetch: 'ECONNREFUSED',
          timeout: 30000,
          retryCount: 3,
        },
        // LLM API error details
        {
          llmId: 'openai-gpt-4',
          llmApiStatusCode: 429,
          llmApiResponseBody: {
            error: {
              message: 'Rate limit exceeded',
              type: 'rate_limit_error',
              code: 'rate_limit_exceeded',
            },
          },
          retryAfter: 60,
        },
      ];

      complexDetailsVariations.forEach((details, index) => {
        const errorResponse = {
          error: true,
          message: `Complex error details test ${index}`,
          stage: 'request_validation',
          details: details,
          originalStatusCode: 400,
        };

        expect(errorResponse).toMatchErrorResponseContract();
      });
    });
  });

  describe('Invalid Error Response Formats (Schema Violations)', () => {
    test('should reject error response missing required error field', () => {
      const invalidResponse = {
        // Missing error field
        message: 'An error occurred',
        originalStatusCode: 500,
      };

      expect(invalidResponse).not.toMatchErrorResponseContract();

      const result = contractValidator.validateErrorResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            message: 'Missing required property: error',
          }),
        ])
      );
    });

    test('should reject error response missing required message field', () => {
      const invalidResponse = {
        error: true,
        // Missing message field
        originalStatusCode: 500,
      };

      expect(invalidResponse).not.toMatchErrorResponseContract();

      const result = contractValidator.validateErrorResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            message: 'Missing required property: message',
          }),
        ])
      );
    });

    test('should reject error response missing required originalStatusCode field', () => {
      const invalidResponse = {
        error: true,
        message: 'An error occurred',
        // Missing originalStatusCode field
      };

      expect(invalidResponse).not.toMatchErrorResponseContract();

      const result = contractValidator.validateErrorResponse(invalidResponse);
      expect(result.isValid).toBe(false);
      expect(result.formattedErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            message: 'Missing required property: originalStatusCode',
          }),
        ])
      );
    });

    test('should reject error response with invalid error field value', () => {
      const invalidResponses = [
        {
          error: false, // Must be true
          message: 'Error',
          originalStatusCode: 500,
        },
        {
          error: 'true', // Must be boolean, not string
          message: 'Error',
          originalStatusCode: 500,
        },
        {
          error: 1, // Must be boolean, not number
          message: 'Error',
          originalStatusCode: 500,
        },
      ];

      invalidResponses.forEach((response) => {
        expect(response).not.toMatchErrorResponseContract();

        const result = contractValidator.validateErrorResponse(response);
        expect(result.isValid).toBe(false);
      });
    });

    test('should reject error response with invalid message field type', () => {
      const invalidResponses = [
        {
          error: true,
          message: 123, // Must be string, not number
          originalStatusCode: 500,
        },
        {
          error: true,
          message: null, // Must be string, not null
          originalStatusCode: 500,
        },
        {
          error: true,
          message: { text: 'error' }, // Must be string, not object
          originalStatusCode: 500,
        },
        {
          error: true,
          message: '', // Must not be empty string
          originalStatusCode: 500,
        },
      ];

      invalidResponses.forEach((response) => {
        expect(response).not.toMatchErrorResponseContract();

        const result = contractValidator.validateErrorResponse(response);
        expect(result.isValid).toBe(false);
      });
    });

    test('should reject error response with invalid originalStatusCode', () => {
      const invalidResponses = [
        {
          error: true,
          message: 'Error',
          originalStatusCode: '500', // Must be number, not string
        },
        {
          error: true,
          message: 'Error',
          originalStatusCode: 99, // Below minimum (100)
        },
        {
          error: true,
          message: 'Error',
          originalStatusCode: 600, // Above maximum (599)
        },
        {
          error: true,
          message: 'Error',
          originalStatusCode: null, // Must be number, not null
        },
      ];

      invalidResponses.forEach((response) => {
        expect(response).not.toMatchErrorResponseContract();

        const result = contractValidator.validateErrorResponse(response);
        expect(result.isValid).toBe(false);
      });
    });

    test('should reject error response with invalid stage enum value', () => {
      const invalidStages = [
        'invalid_stage',
        'request-validation', // Wrong format (should use underscore)
        'REQUEST_VALIDATION', // Wrong case
        'api_key_error', // Not in enum
        123, // Wrong type
        null, // Wrong type
      ];

      invalidStages.forEach((stage) => {
        const response = {
          error: true,
          message: 'Error with invalid stage',
          stage: stage,
          originalStatusCode: 500,
        };

        expect(response).not.toMatchErrorResponseContract();

        const result = contractValidator.validateErrorResponse(response);
        expect(result.isValid).toBe(false);
      });
    });

    test('should reject error response with invalid details field type', () => {
      const invalidResponses = [
        {
          error: true,
          message: 'Error',
          details: 'string', // Must be object, not string
          originalStatusCode: 500,
        },
        {
          error: true,
          message: 'Error',
          details: 123, // Must be object, not number
          originalStatusCode: 500,
        },
        {
          error: true,
          message: 'Error',
          details: [], // Must be object, not array
          originalStatusCode: 500,
        },
      ];

      invalidResponses.forEach((response) => {
        expect(response).not.toMatchErrorResponseContract();

        const result = contractValidator.validateErrorResponse(response);
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

    test('should reject error response with additional properties', () => {
      const invalidResponse = {
        error: true,
        message: 'Error with extra field',
        stage: 'request_validation',
        details: { reason: 'test' },
        originalStatusCode: 400,
        unexpectedField: 'not allowed', // Additional property
      };

      expect(invalidResponse).not.toMatchErrorResponseContract();

      const result = contractValidator.validateErrorResponse(invalidResponse);
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

  describe('Contract Examples Validation (Section 2.2)', () => {
    test('should validate Example 1: Request Validation Error', () => {
      const example1 = {
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
      };

      expect(example1).toMatchErrorResponseContract();

      // Validate status code is appropriate for stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        400,
        'request_validation'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should validate Example 2: API Key Retrieval Error', () => {
      const example2 = {
        error: true,
        message: 'Failed to retrieve API key for the specified LLM provider.',
        stage: 'api_key_retrieval_error',
        details: {
          llmId: 'some-cloud-llm',
          reason:
            "The environment variable 'EXPECTED_API_KEY_ENV_VAR' is not set on the proxy server.",
        },
        originalStatusCode: 500,
      };

      expect(example2).toMatchErrorResponseContract();

      // Validate status code is appropriate for stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        500,
        'api_key_retrieval_error'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should validate Example 3: LLM Forwarding Network Error', () => {
      const example3 = {
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
      };

      expect(example3).toMatchErrorResponseContract();

      // Validate status code is appropriate for stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        502,
        'llm_forwarding_error_network'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should validate Example 4: Downstream LLM API Error', () => {
      const example4 = {
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
      };

      expect(example4).toMatchErrorResponseContract();

      // Validate status code is appropriate for stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        400,
        'llm_forwarding_error_http_client'
      );
      expect(statusValidation.isValid).toBe(true);
    });
  });

  describe('Status Code Validation for Stages', () => {
    test('should validate appropriate status codes for each error stage', () => {
      const stageStatusMappings = [
        {
          stage: 'request_validation',
          validCodes: [400],
          invalidCodes: [401, 500, 502],
        },
        {
          stage: 'llm_config_lookup_error',
          validCodes: [400, 404],
          invalidCodes: [401, 500],
        },
        {
          stage: 'api_key_retrieval_error',
          validCodes: [500, 401, 403],
          invalidCodes: [400, 404],
        },
        {
          stage: 'llm_forwarding_error_network',
          validCodes: [502],
          invalidCodes: [400, 401, 500],
        },
        {
          stage: 'llm_forwarding_error_http_client',
          validCodes: [400, 401, 403, 404, 429],
          invalidCodes: [500, 502],
        },
        {
          stage: 'llm_forwarding_error_http_server',
          validCodes: [502, 503],
          invalidCodes: [400, 401, 404],
        },
        {
          stage: 'internal_proxy_error',
          validCodes: [500],
          invalidCodes: [400, 401, 502],
        },
        {
          stage: 'initialization_failure',
          validCodes: [503],
          invalidCodes: [400, 401, 500],
        },
      ];

      stageStatusMappings.forEach(({ stage, validCodes, invalidCodes }) => {
        // Test valid status codes
        validCodes.forEach((statusCode) => {
          const validation = contractValidator.validateStatusCodeForStage(
            statusCode,
            stage
          );
          expect(validation.isValid).toBe(true);
          expect(validation.message).toContain(
            `Status code ${statusCode} is valid for stage '${stage}'`
          );
        });

        // Test invalid status codes
        invalidCodes.forEach((statusCode) => {
          const validation = contractValidator.validateStatusCodeForStage(
            statusCode,
            stage
          );
          expect(validation.isValid).toBe(false);
          expect(validation.message).toContain(
            `Status code ${statusCode} is not valid for stage '${stage}'`
          );
        });
      });
    });

    test('should allow any status code for unknown stages', () => {
      const unknownStage = 'unknown_custom_stage';
      const validation = contractValidator.validateStatusCodeForStage(
        418,
        unknownStage
      );
      expect(validation.isValid).toBe(true); // Should allow any code for unknown stages
    });
  });

  describe('Security Requirements Validation', () => {
    test('should detect API key exposure in error responses', () => {
      const responsesWithAPIKeys = [
        {
          error: true,
          message: 'API key sk-1234567890abcdef1234567890abcdef failed',
          originalStatusCode: 401,
        },
        {
          error: true,
          message: 'Error occurred',
          details: {
            apiKey: 'sk-ant-api03-1234567890abcdef',
            reason: 'Invalid key',
          },
          originalStatusCode: 401,
        },
        {
          error: true,
          message: 'Authorization failed',
          details: {
            headers: {
              Authorization: 'Bearer sk-1234567890abcdef',
            },
          },
          originalStatusCode: 401,
        },
      ];

      responsesWithAPIKeys.forEach((response) => {
        expect(response).not.toMeetSecurityRequirements();

        const securityResult =
          contractValidator.validateSecurityRequirements(response);
        expect(securityResult.isSecure).toBe(false);
        expect(securityResult.issues.length).toBeGreaterThan(0);
        expect(securityResult.issues[0].type).toBe('api_key_exposure');
      });
    });

    test('should detect sensitive configuration exposure', () => {
      const responsesWithSensitiveData = [
        {
          error: true,
          message: 'Configuration file /etc/app/.env not found',
          originalStatusCode: 500,
        },
        {
          error: true,
          message: 'Error occurred',
          details: {
            configFile: '/path/to/secrets.json',
            privateKey: 'sensitive-data',
          },
          originalStatusCode: 500,
        },
      ];

      responsesWithSensitiveData.forEach((response) => {
        expect(response).not.toMeetSecurityRequirements();

        const securityResult =
          contractValidator.validateSecurityRequirements(response);
        expect(securityResult.isSecure).toBe(false);
        expect(securityResult.issues.length).toBeGreaterThan(0);
        expect(securityResult.issues[0].type).toBe('sensitive_data_exposure');
      });
    });

    test('should pass security validation for clean error responses', () => {
      const secureResponses = [
        {
          error: true,
          message: 'Request validation failed',
          stage: 'request_validation',
          details: {
            missingFields: ['llmId'],
          },
          originalStatusCode: 400,
        },
        {
          error: true,
          message: 'LLM provider not available',
          stage: 'llm_forwarding_error_network',
          details: {
            llmId: 'provider-llm',
            targetUrl: 'https://api.provider.com/v1/chat',
          },
          originalStatusCode: 502,
        },
      ];

      secureResponses.forEach((response) => {
        expect(response).toMeetSecurityRequirements();

        const securityResult =
          contractValidator.validateSecurityRequirements(response);
        expect(securityResult.isSecure).toBe(true);
        expect(securityResult.issues).toHaveLength(0);
      });
    });
  });

  describe('Error Response Schema Information', () => {
    test('should provide correct schema metadata', () => {
      const schemaInfo = contractValidator.getSchemaInfo();

      expect(schemaInfo.errorResponseSchema).toEqual({
        id: 'llm-proxy-error-response-schema',
        title: 'LLM Proxy Server Error Response Schema',
        required: ['error', 'message', 'originalStatusCode'],
        stageEnum: expect.arrayContaining([
          'request_validation',
          'llm_config_lookup_error',
          'api_key_retrieval_error',
          'llm_forwarding_error_network',
          'llm_forwarding_error_http_client',
          'llm_forwarding_error_http_server',
          'internal_proxy_error',
          'initialization_failure',
        ]),
      });
    });

    test('should validate all contract examples without exceptions', () => {
      // All examples from PROXY_API_CONTRACT.md Section 2.2
      const contractExamples = [
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
          message: 'Failed to retrieve API key for the specified LLM provider.',
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
      ];

      contractExamples.forEach((example, index) => {
        expect(() => {
          contractValidator.assertValidErrorResponse(
            example,
            `Contract example ${index + 1} validation`
          );
        }).not.toThrow();
      });
    });
  });
});
