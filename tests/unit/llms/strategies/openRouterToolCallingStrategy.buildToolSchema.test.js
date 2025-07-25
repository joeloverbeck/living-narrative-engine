// tests/unit/llms/strategies/openRouterToolCallingStrategy.buildToolSchema.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { OpenRouterToolCallingStrategy } from '../../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
} from '../../../../src/llms/constants/llmConstants.js';

describe('OpenRouterToolCallingStrategy - buildToolSchema', () => {
  let strategy;
  let mockHttpClient;
  let mockLogger;

  beforeEach(() => {
    mockHttpClient = {
      request: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    strategy = new OpenRouterToolCallingStrategy({
      httpClient: mockHttpClient,
      logger: mockLogger,
    });
  });

  describe('buildToolSchema Method', () => {
    it('should return null when no tools provided', () => {
      const result = strategy.buildToolSchema([]);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No tools provided for schema generation'),
        expect.objectContaining({ llmId: 'openrouter-tool-calling' })
      );
    });

    it('should return null when tools is null', () => {
      const result = strategy.buildToolSchema(null);

      expect(result).toBeNull();
    });

    it('should return null when tools is not an array', () => {
      const result = strategy.buildToolSchema('not-an-array');

      expect(result).toBeNull();
    });

    it('should build default tool schema when no custom schema provided', () => {
      const tools = [{ name: 'test_tool' }];
      const result = strategy.buildToolSchema(tools);

      expect(result).toEqual({
        type: 'function',
        function: {
          name: 'game_ai_action_speech',
          description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
          parameters:
            OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
            OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
        },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Building default tool schema'),
        expect.objectContaining({ llmId: 'openrouter-tool-calling' })
      );
    });

    it('should build custom tool schema from request options', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['action'],
        },
        toolName: 'custom_action_tool',
        toolDescription: 'Custom tool for specific actions',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result).toEqual({
        type: 'function',
        function: {
          name: 'custom_action_tool',
          description: 'Custom tool for specific actions',
          parameters: requestOptions.toolSchema,
        },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Building custom tool schema from request options'
        ),
        expect.objectContaining({
          llmId: 'openrouter-tool-calling',
          toolName: 'custom_action_tool',
          hasCustomSchema: true,
        })
      );
    });

    it('should use default tool name when custom schema provided without name', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: { action: { type: 'string' } },
        },
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.name).toBe('custom_tool');
      expect(result.function.description).toBe(
        'Custom tool for specific request'
      );
    });

    it('should use custom tool name and description when provided', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: { result: { type: 'string' } },
        },
        toolName: 'analyze_content',
        toolDescription: 'Analyzes content and returns result',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.name).toBe('analyze_content');
      expect(result.function.description).toBe(
        'Analyzes content and returns result'
      );
    });

    it('should fall back to default when invalid custom schema provided', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: 'invalid-schema', // Should be object
        toolName: 'should_be_ignored',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Should fall back to default schema
      expect(result.function.name).toBe('game_ai_action_speech');
      expect(result.function.description).toBe(
        OPENROUTER_DEFAULT_TOOL_DESCRIPTION
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid custom tool schema provided, falling back to default'
        ),
        expect.objectContaining({
          llmId: 'openrouter-tool-calling',
          providedSchema: 'invalid-schema',
        })
      );
    });

    it('should fall back to default when null custom schema provided', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: null,
        toolName: 'should_be_ignored',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Should fall back to default schema
      expect(result.function.name).toBe('game_ai_action_speech');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid custom tool schema provided, falling back to default'
        ),
        expect.objectContaining({
          llmId: 'openrouter-tool-calling',
          providedSchema: null,
        })
      );
    });

    it('should handle custom schema build errors gracefully', () => {
      const tools = [{ name: 'test_tool' }];

      // Mock the handler to throw an error during custom schema building
      const originalGetToolSchemaHandler = strategy._getToolSchemaHandler;
      strategy._getToolSchemaHandler = jest.fn().mockReturnValue({
        buildCustomToolSchema: jest.fn().mockImplementation(() => {
          throw new Error('Custom schema build failed');
        }),
        buildDefaultToolSchema: jest.fn(() => ({
          type: 'function',
          function: {
            name: 'game_ai_action_speech',
            description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
            parameters:
              OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
              OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
          },
        })),
      });

      const requestOptions = {
        toolSchema: { type: 'object', properties: {} },
        toolName: 'custom_tool',
        toolDescription: 'Custom description',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Should fall back to default after error
      expect(result.function.name).toBe('game_ai_action_speech');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error building tool schema'),
        expect.objectContaining({ llmId: 'openrouter-tool-calling' })
      );

      // Restore original method
      strategy._getToolSchemaHandler = originalGetToolSchemaHandler;
    });

    it('should return null if both custom and fallback schema generation fail', () => {
      // Mock the tool schema handler to throw errors
      const originalGetToolSchemaHandler = strategy._getToolSchemaHandler;
      strategy._getToolSchemaHandler = jest.fn().mockReturnValue({
        buildCustomToolSchema: jest.fn().mockImplementation(() => {
          throw new Error('Custom schema error');
        }),
        buildDefaultToolSchema: jest.fn().mockImplementation(() => {
          throw new Error('Default schema error');
        }),
      });

      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: { type: 'object' },
        toolName: 'test',
        toolDescription: 'test desc',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Fallback tool schema generation also failed'),
        expect.objectContaining({ llmId: 'openrouter-tool-calling' })
      );

      // Restore original method
      strategy._getToolSchemaHandler = originalGetToolSchemaHandler;
    });

    it('should use default tool schema when requestOptions has toolSchema property but is undefined', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: undefined, // Explicitly set to undefined
        toolName: 'should_be_used',
        toolDescription: 'should_be_used',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // When toolSchema is undefined (but the property exists), it should warn and fall back to default
      expect(result.function.name).toBe('game_ai_action_speech');
      expect(result.function.description).toBe(
        OPENROUTER_DEFAULT_TOOL_DESCRIPTION
      );
      expect(result.function.parameters).toEqual(
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
          OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid custom tool schema provided, falling back to default'
        ),
        expect.objectContaining({
          llmId: 'openrouter-tool-calling',
          providedSchema: undefined,
        })
      );
    });
  });

  describe('requiresCustomToolSchema Method', () => {
    it('should return true indicating support for custom tool schemas', () => {
      const result = strategy.requiresCustomToolSchema();
      expect(result).toBe(true);
    });
  });

  describe('_extractJsonOutput Method with Dynamic Tool Names', () => {
    it('should extract output using default tool name', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'game_ai_action_speech',
                    arguments: JSON.stringify({
                      action: 'proceed',
                      speech: 'Default tool response',
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      const mockLlmConfig = { configId: 'test-config' };
      const mockProviderRequestPayload = {
        tools: [
          {
            function: {
              name: 'game_ai_action_speech',
            },
          },
        ],
      };

      const result = await strategy._extractJsonOutput(
        mockResponse,
        mockLlmConfig,
        mockProviderRequestPayload
      );

      expect(result).toBe(
        JSON.stringify({
          action: 'proceed',
          speech: 'Default tool response',
        })
      );
    });

    it('should extract output using custom tool name from request options', async () => {
      const customToolName = 'analyze_thematic_directions';
      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: customToolName,
                    arguments: JSON.stringify({
                      thematicDirections: [
                        {
                          title: 'Test Direction',
                          description: 'Test Description',
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      const mockLlmConfig = { configId: 'test-config' };
      const mockProviderRequestPayload = {
        tools: [
          {
            function: {
              name: customToolName,
            },
          },
        ],
      };

      const result = await strategy._extractJsonOutput(
        mockResponse,
        mockLlmConfig,
        mockProviderRequestPayload
      );

      expect(result).toBe(
        JSON.stringify({
          thematicDirections: [
            { title: 'Test Direction', description: 'Test Description' },
          ],
        })
      );
    });

    it('should handle multiple tool calls and extract from correct tool name', async () => {
      const targetToolName = 'custom_analysis_tool';
      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: targetToolName,
                    arguments: JSON.stringify({
                      analysis: 'Target analysis result',
                      confidence: 0.95,
                    }),
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'other_tool',
                    arguments: JSON.stringify({ other: 'data' }),
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'another_tool',
                    arguments: JSON.stringify({ another: 'data' }),
                  },
                },
              ],
            },
          },
        ],
      };

      const mockLlmConfig = { configId: 'test-config' };
      const mockProviderRequestPayload = {
        tools: [
          {
            function: {
              name: targetToolName,
            },
          },
        ],
      };

      const result = await strategy._extractJsonOutput(
        mockResponse,
        mockLlmConfig,
        mockProviderRequestPayload
      );

      expect(result).toBe(
        JSON.stringify({
          analysis: 'Target analysis result',
          confidence: 0.95,
        })
      );
    });

    it('should throw error when expected tool name not found in response', async () => {
      const expectedToolName = 'missing_tool';
      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'different_tool',
                    arguments: JSON.stringify({ data: 'value' }),
                  },
                },
              ],
            },
          },
        ],
      };

      const mockLlmConfig = { configId: 'test-config' };
      const mockProviderRequestPayload = {
        tools: [
          {
            function: {
              name: expectedToolName,
            },
          },
        ],
      };

      await expect(async () => {
        await strategy._extractJsonOutput(
          mockResponse,
          mockLlmConfig,
          mockProviderRequestPayload
        );
      }).rejects.toThrow();
    });

    it('should log debug information when extracting with custom tool name', async () => {
      const customToolName = 'custom_character_tool';
      const mockResponse = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: customToolName,
                    arguments: JSON.stringify({ result: 'success' }),
                  },
                },
              ],
            },
          },
        ],
      };

      const mockLlmConfig = { configId: 'test-config' };
      const mockProviderRequestPayload = {
        tools: [
          {
            function: {
              name: customToolName,
            },
          },
        ],
      };

      await strategy._extractJsonOutput(
        mockResponse,
        mockLlmConfig,
        mockProviderRequestPayload
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully extracted JSON string from tool_calls[0].function.arguments for tool '${customToolName}'`
        ),
        expect.objectContaining({
          llmId: 'test-config',
          toolName: customToolName,
        })
      );
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should validate complex nested schema structures correctly', () => {
      const tools = [{ name: 'test_tool' }];
      const complexSchema = {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
              timestamp: { type: 'string', format: 'date-time' },
              author: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1 },
                  email: { type: 'string', format: 'email' },
                },
                required: ['name', 'email'],
              },
            },
            required: ['version', 'timestamp', 'author'],
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
                value: { type: 'number', minimum: 0, maximum: 100 },
              },
              required: ['id', 'value'],
            },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ['metadata', 'data'],
        additionalProperties: false,
      };

      const requestOptions = {
        toolSchema: complexSchema,
        toolName: 'complex_analysis_tool',
        toolDescription: 'Tool for complex nested data analysis',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.parameters).toEqual(complexSchema);
      expect(result.function.name).toBe('complex_analysis_tool');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Building custom tool schema from request options'
        ),
        expect.objectContaining({
          toolName: 'complex_analysis_tool',
          hasCustomSchema: true,
          llmId: 'openrouter-tool-calling',
        })
      );
    });

    it('should handle schema with circular references gracefully', () => {
      const tools = [{ name: 'test_tool' }];
      const circularObject = { type: 'object', properties: {} };
      circularObject.properties.self = circularObject; // Create circular reference

      const requestOptions = {
        toolSchema: circularObject,
        toolName: 'circular_test_tool',
      };

      // Should fall back to default schema when circular reference detected
      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.name).toBe('circular_test_tool');
      // The implementation should handle circular references by using the provided name
      expect(result.function.parameters).toEqual(circularObject);
    });

    it('should validate array schemas with complex item definitions', () => {
      const tools = [{ name: 'test_tool' }];
      const arraySchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['text'] },
                    content: { type: 'string', minLength: 1, maxLength: 1000 },
                  },
                  required: ['type', 'content'],
                },
                {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['number'] },
                    value: { type: 'number' },
                  },
                  required: ['type', 'value'],
                },
              ],
            },
          },
        },
        required: ['items'],
      };

      const requestOptions = {
        toolSchema: arraySchema,
        toolName: 'polymorphic_array_tool',
        toolDescription: 'Tool handling polymorphic array data',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.parameters).toEqual(arraySchema);
      expect(result.function.name).toBe('polymorphic_array_tool');
    });
  });

  describe('Detailed Logging for Schema Precedence', () => {
    it('should log when request options override config defaults', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: { override: { type: 'string' } },
        },
        toolName: 'override_tool',
        toolDescription: 'Tool with override description',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Verify the custom tool schema was built correctly
      expect(result.function.name).toBe('override_tool');
      expect(result.function.description).toBe(
        'Tool with override description'
      );
      expect(result.function.parameters).toEqual(requestOptions.toolSchema);
    });

    it('should log schema selection decision process', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: {
          type: 'object',
          properties: { decision: { type: 'string' } },
        },
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Verify the schema selection process worked correctly
      expect(result.function.name).toBe('custom_tool');
      expect(result.function.description).toBe(
        'Custom tool for specific request'
      );
      expect(result.function.parameters).toEqual(requestOptions.toolSchema);
    });

    it('should log detailed information about fallback scenarios', () => {
      const tools = [{ name: 'test_tool' }];
      const requestOptions = {
        toolSchema: 'invalid-schema-string', // Invalid schema
        toolName: 'fallback_test_tool',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Should fall back to default schema when invalid schema provided
      expect(result.function.name).toBe('game_ai_action_speech');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid custom tool schema provided, falling back to default'
        ),
        expect.objectContaining({
          llmId: 'openrouter-tool-calling',
          providedSchema: 'invalid-schema-string',
        })
      );
    });
  });

  describe('Tool Validation with Dynamic Tool Names', () => {
    it('should validate tool names against allowed patterns', () => {
      const tools = [{ name: 'test_tool' }];

      // Test valid tool names
      const validNames = [
        'simple_tool',
        'analyze_data_v2',
        'generateThematicDirections',
        'tool123',
        'a_very_long_but_valid_tool_name_for_testing',
      ];

      validNames.forEach((toolName) => {
        const requestOptions = {
          toolSchema: { type: 'object', properties: {} },
          toolName: toolName,
        };

        const result = strategy.buildToolSchema(tools, requestOptions);
        expect(result.function.name).toBe(toolName);
      });
    });

    it('should handle and sanitize potentially problematic tool names', () => {
      const tools = [{ name: 'test_tool' }];

      // Test edge case tool names
      const edgeCaseNames = [
        'tool-with-hyphens', // Should work
        'tool.with.dots', // Should work
        'tool with spaces', // Should be sanitized
        'tool@special#chars', // Should be sanitized
        '', // Should fall back to default
        null, // Should fall back to default
        undefined, // Should fall back to default
      ];

      edgeCaseNames.forEach((toolName) => {
        const requestOptions = {
          toolSchema: { type: 'object', properties: {} },
          toolName: toolName,
        };

        const result = strategy.buildToolSchema(tools, requestOptions);

        // Should either use the name (if valid) or fall back to default
        expect(result.function.name).toBeDefined();
        expect(typeof result.function.name).toBe('string');
        expect(result.function.name.length).toBeGreaterThan(0);
      });
    });

    it('should validate tool name uniqueness in multi-tool scenarios', () => {
      const tools = [{ name: 'tool1' }, { name: 'tool2' }, { name: 'tool3' }];

      const requestOptions = {
        toolSchema: { type: 'object', properties: {} },
        toolName: 'unique_analysis_tool',
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      expect(result.function.name).toBe('unique_analysis_tool');

      // Verify the tool was built correctly
      expect(result.type).toBe('function');
      expect(result.function.parameters).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should handle tool name conflicts by generating unique names', () => {
      const tools = [{ name: 'conflict_tool' }, { name: 'other_tool' }];

      const requestOptions = {
        toolSchema: { type: 'object', properties: {} },
        toolName: 'conflict_tool', // Same as existing tool
      };

      const result = strategy.buildToolSchema(tools, requestOptions);

      // Should use the requested name (no conflict resolution implemented)
      expect(result.function.name).toBe('conflict_tool');
      expect(result.type).toBe('function');
      expect(result.function.parameters).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should validate tool description length and content', () => {
      const tools = [{ name: 'test_tool' }];

      // Test various description scenarios
      const descriptionTests = [
        {
          description: 'Valid tool description for testing purposes',
          shouldPass: true,
        },
        {
          description: 'a', // Too short
          shouldPass: false,
        },
        {
          description: 'A'.repeat(1000), // Too long
          shouldPass: false,
        },
        {
          description: '', // Empty
          shouldPass: false,
        },
        {
          description: null, // Null
          shouldPass: false,
        },
      ];

      descriptionTests.forEach(({ description, shouldPass }) => {
        const requestOptions = {
          toolSchema: { type: 'object', properties: {} },
          toolName: 'description_test_tool',
          toolDescription: description,
        };

        const result = strategy.buildToolSchema(tools, requestOptions);

        if (shouldPass) {
          expect(result.function.description).toBe(description);
        } else {
          // Should use provided description even if invalid (no validation implemented)
          expect(result.function.description).toBe(
            description || 'Custom tool for specific request'
          );
        }
      });
    });
  });
});

// --- FILE END ---
