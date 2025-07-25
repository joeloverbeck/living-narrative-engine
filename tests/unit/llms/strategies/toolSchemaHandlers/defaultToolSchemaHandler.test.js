// tests/unit/llms/strategies/toolSchemaHandlers/defaultToolSchemaHandler.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { DefaultToolSchemaHandler } from '../../../../../src/llms/strategies/toolSchemaHandlers/defaultToolSchemaHandler.js';
import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
} from '../../../../../src/llms/constants/llmConstants.js';

describe('DefaultToolSchemaHandler', () => {
  let handler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    handler = new DefaultToolSchemaHandler({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should create instance with valid logger', () => {
      expect(handler).toBeInstanceOf(DefaultToolSchemaHandler);
    });

    it('should throw error without logger', () => {
      expect(() => new DefaultToolSchemaHandler({})).toThrow(
        'DefaultToolSchemaHandler: Constructor requires a valid ILogger instance.'
      );
    });

    it('should throw error with invalid logger', () => {
      expect(() => new DefaultToolSchemaHandler({ logger: null })).toThrow(
        'DefaultToolSchemaHandler: Constructor requires a valid ILogger instance.'
      );
    });
  });

  describe('buildDefaultToolSchema', () => {
    const llmId = 'test-llm';

    it('should build default tool schema with standard parameters', () => {
      const result = handler.buildDefaultToolSchema(llmId);

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
        expect.stringContaining(
          "Building default tool schema with name 'game_ai_action_speech'"
        ),
        expect.objectContaining({ llmId, toolName: 'game_ai_action_speech' })
      );
    });

    it('should use custom tool name from request options', () => {
      const requestOptions = { toolName: 'custom_action' };
      const result = handler.buildDefaultToolSchema(llmId, requestOptions);

      expect(result.function.name).toBe('custom_action');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Building default tool schema with name 'custom_action'"
        ),
        expect.objectContaining({ llmId, toolName: 'custom_action' })
      );
    });

    it('should use custom tool description from request options', () => {
      const requestOptions = { toolDescription: 'Custom description' };
      const result = handler.buildDefaultToolSchema(llmId, requestOptions);

      expect(result.function.description).toBe('Custom description');
    });

    it('should handle empty request options', () => {
      const result = handler.buildDefaultToolSchema(llmId, {});

      expect(result.function.name).toBe('game_ai_action_speech');
      expect(result.function.description).toBe(
        OPENROUTER_DEFAULT_TOOL_DESCRIPTION
      );
    });
  });

  describe('validateToolSchema', () => {
    const llmId = 'test-llm';

    it('should validate correct tool schema', () => {
      const validSchema = {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool description',
          parameters: { type: 'object', properties: {} },
        },
      };

      const result = handler.validateToolSchema(validSchema, llmId);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Tool schema validation passed for 'test_tool'"
        ),
        expect.objectContaining({ llmId, toolName: 'test_tool' })
      );
    });

    it('should reject null schema', () => {
      const result = handler.validateToolSchema(null, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid tool schema - must be an object'),
        expect.objectContaining({ llmId, toolSchema: null })
      );
    });

    it('should reject schema with wrong type', () => {
      const invalidSchema = { type: 'invalid' };
      const result = handler.validateToolSchema(invalidSchema, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid tool schema - type must be 'function'"
        ),
        expect.objectContaining({ llmId, type: 'invalid' })
      );
    });

    it('should reject schema without function property', () => {
      const invalidSchema = { type: 'function' };
      const result = handler.validateToolSchema(invalidSchema, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool schema - function property must be an object'
        ),
        expect.objectContaining({ llmId })
      );
    });

    it('should reject schema with invalid function.name', () => {
      const invalidSchema = {
        type: 'function',
        function: {
          name: '',
          description: 'Test',
          parameters: {},
        },
      };
      const result = handler.validateToolSchema(invalidSchema, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool schema - function.name must be a non-empty string'
        ),
        expect.objectContaining({ llmId, name: '' })
      );
    });

    it('should reject schema with invalid function.description', () => {
      const invalidSchema = {
        type: 'function',
        function: {
          name: 'test_tool',
          description: null,
          parameters: {},
        },
      };
      const result = handler.validateToolSchema(invalidSchema, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool schema - function.description must be a non-empty string'
        ),
        expect.objectContaining({ llmId, description: null })
      );
    });

    it('should reject schema with invalid function.parameters', () => {
      const invalidSchema = {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: null,
        },
      };
      const result = handler.validateToolSchema(invalidSchema, llmId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool schema - function.parameters must be an object'
        ),
        expect.objectContaining({ llmId, parameters: null })
      );
    });
  });

  describe('buildCustomToolSchema', () => {
    const llmId = 'test-llm';
    const customParameters = {
      type: 'object',
      properties: {
        action: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['action'],
    };

    it('should build custom tool schema with valid inputs', () => {
      const toolName = 'custom_tool';
      const toolDescription = 'Custom tool for testing';

      const result = handler.buildCustomToolSchema(
        customParameters,
        toolName,
        toolDescription,
        llmId
      );

      expect(result).toEqual({
        type: 'function',
        function: {
          name: toolName,
          description: toolDescription,
          parameters: customParameters,
        },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Built custom tool schema with name 'custom_tool'"
        ),
        expect.objectContaining({
          llmId,
          toolName,
          schemaProperties: ['action', 'confidence'],
        })
      );
    });

    it('should throw error with invalid custom parameters', () => {
      expect(() =>
        handler.buildCustomToolSchema(null, 'tool', 'desc', llmId)
      ).toThrow('Custom parameters must be an object');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid custom parameters - must be an object'
        ),
        expect.objectContaining({ llmId, customParameters: null })
      );
    });

    it('should throw error with invalid tool name', () => {
      expect(() =>
        handler.buildCustomToolSchema(customParameters, '', 'desc', llmId)
      ).toThrow('Tool name must be a non-empty string');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool name - must be a non-empty string'
        ),
        expect.objectContaining({ llmId, toolName: '' })
      );
    });

    it('should throw error with invalid tool description', () => {
      expect(() =>
        handler.buildCustomToolSchema(customParameters, 'tool', null, llmId)
      ).toThrow('Tool description must be a non-empty string');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid tool description - must be a non-empty string'
        ),
        expect.objectContaining({ llmId, toolDescription: null })
      );
    });

    it('should handle parameters without properties', () => {
      const simpleParameters = { type: 'object' };
      const result = handler.buildCustomToolSchema(
        simpleParameters,
        'tool',
        'desc',
        llmId
      );

      expect(result.function.parameters).toEqual(simpleParameters);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Built custom tool schema with name 'tool'"),
        expect.objectContaining({
          llmId,
          toolName: 'tool',
          schemaProperties: [],
        })
      );
    });
  });
});

// --- FILE END ---
