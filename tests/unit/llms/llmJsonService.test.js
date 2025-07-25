import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the dependencies before importing the service
jest.mock('../../../src/utils/jsonCleaning.js', () => ({
  cleanLLMJsonOutput: jest.fn(),
}));

jest.mock('../../../src/utils/jsonRepair.js', () => ({
  JsonProcessingError: jest.fn(),
  initialParse: jest.fn(),
  repairAndParse: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

// Import after mocks are set up
import { LlmJsonService } from '../../../src/llms/llmJsonService.js';
import { cleanLLMJsonOutput } from '../../../src/utils/jsonCleaning.js';
import {
  JsonProcessingError,
  initialParse,
  repairAndParse,
} from '../../../src/utils/jsonRepair.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

describe('LlmJsonService', () => {
  let llmJsonService;
  let mockLogger;
  let mockDispatcher;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance
    llmJsonService = new LlmJsonService();

    // Create mock objects
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    // Setup default mock implementations
    ensureValidLogger.mockReturnValue(mockLogger);
    safeDispatchError.mockImplementation(() => {});

    // Setup JsonProcessingError as a proper Error constructor
    JsonProcessingError.mockImplementation((message, details = {}) => {
      const error = new Error(message);
      error.name = 'JsonProcessingError';
      error.stage = details.stage;
      error.originalError = details.originalError;
      error.attemptedJsonString = details.attemptedJsonString;
      return error;
    });
  });

  describe('clean', () => {
    it('should delegate to cleanLLMJsonOutput and return result', () => {
      // Arrange
      const rawOutput = 'test input';
      const expectedResult = 'cleaned output';
      cleanLLMJsonOutput.mockReturnValue(expectedResult);

      // Act
      const result = llmJsonService.clean(rawOutput);

      // Assert
      expect(cleanLLMJsonOutput).toHaveBeenCalledWith(rawOutput);
      expect(result).toBe(expectedResult);
    });

    it('should handle non-string input', () => {
      // Arrange
      const rawOutput = { key: 'value' };
      const expectedResult = { key: 'value' };
      cleanLLMJsonOutput.mockReturnValue(expectedResult);

      // Act
      const result = llmJsonService.clean(rawOutput);

      // Assert
      expect(cleanLLMJsonOutput).toHaveBeenCalledWith(rawOutput);
      expect(result).toBe(expectedResult);
    });

    it('should handle null input', () => {
      // Arrange
      const rawOutput = null;
      const expectedResult = null;
      cleanLLMJsonOutput.mockReturnValue(expectedResult);

      // Act
      const result = llmJsonService.clean(rawOutput);

      // Assert
      expect(cleanLLMJsonOutput).toHaveBeenCalledWith(rawOutput);
      expect(result).toBe(expectedResult);
    });
  });

  describe('parseAndRepair', () => {
    describe('input validation', () => {
      it('should throw TypeError for non-string input', async () => {
        // Arrange
        const invalidInput = 123;

        // Act & Assert
        await expect(
          llmJsonService.parseAndRepair(invalidInput)
        ).rejects.toThrow(
          new TypeError("Input 'jsonString' must be a string.")
        );
      });

      it('should log error for non-string input when no dispatcher provided', async () => {
        // Arrange
        const invalidInput = 123;

        // Act & Assert
        await expect(
          llmJsonService.parseAndRepair(invalidInput, { logger: mockLogger })
        ).rejects.toThrow(TypeError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "parseAndRepair: Input 'jsonString' must be a string. Received type: number"
        );
      });

      it('should dispatch error for non-string input when dispatcher provided', async () => {
        // Arrange
        const invalidInput = 123;

        // Act & Assert
        await expect(
          llmJsonService.parseAndRepair(invalidInput, {
            logger: mockLogger,
            dispatcher: mockDispatcher,
          })
        ).rejects.toThrow(TypeError);

        expect(safeDispatchError).toHaveBeenCalledWith(
          mockDispatcher,
          "parseAndRepair: Input 'jsonString' must be a string. Received type: number"
        );
      });
    });

    describe('empty/null cleaned JSON handling', () => {
      it('should throw JsonProcessingError for null cleaned JSON', async () => {
        // Arrange
        const jsonString = 'some input';
        cleanLLMJsonOutput.mockReturnValue(null);

        // Act & Assert
        await expect(llmJsonService.parseAndRepair(jsonString)).rejects.toThrow(
          'Cleaned JSON string is null or empty, cannot parse.'
        );
      });

      it('should throw JsonProcessingError for empty cleaned JSON', async () => {
        // Arrange
        const jsonString = 'some input';
        cleanLLMJsonOutput.mockReturnValue('   '); // Only whitespace

        // Act & Assert
        await expect(llmJsonService.parseAndRepair(jsonString)).rejects.toThrow(
          'Cleaned JSON string is null or empty, cannot parse.'
        );
      });

      it('should log error for empty cleaned JSON when no dispatcher provided', async () => {
        // Arrange
        const jsonString = 'some input';
        cleanLLMJsonOutput.mockReturnValue('');

        // Act & Assert
        await expect(
          llmJsonService.parseAndRepair(jsonString, { logger: mockLogger })
        ).rejects.toThrow(
          'Cleaned JSON string is null or empty, cannot parse.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'parseAndRepair: Cleaned JSON string is null or empty, cannot parse.',
          { originalInput: jsonString }
        );
      });

      it('should dispatch error for empty cleaned JSON when dispatcher provided', async () => {
        // Arrange
        const jsonString = 'some input';
        cleanLLMJsonOutput.mockReturnValue('');

        // Act & Assert
        await expect(
          llmJsonService.parseAndRepair(jsonString, {
            logger: mockLogger,
            dispatcher: mockDispatcher,
          })
        ).rejects.toThrow(
          'Cleaned JSON string is null or empty, cannot parse.'
        );

        expect(safeDispatchError).toHaveBeenCalledWith(
          mockDispatcher,
          'parseAndRepair: Cleaned JSON string is null or empty, cannot parse.',
          { originalInput: jsonString }
        );
      });
    });

    describe('successful parsing', () => {
      it('should successfully parse valid JSON on first attempt', async () => {
        // Arrange
        const jsonString = '{"valid": "json"}';
        const cleanedJson = '{"valid": "json"}';
        const expectedResult = { valid: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockReturnValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(initialParse).toHaveBeenCalledWith(cleanedJson, mockLogger);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'parseAndRepair: Successfully parsed JSON on first attempt after cleaning.',
          {
            inputLength: jsonString.length,
            cleanedLength: cleanedJson.length,
          }
        );
        expect(repairAndParse).not.toHaveBeenCalled();
      });

      it('should fallback to repair when initial parse fails', async () => {
        // Arrange
        const jsonString = '{invalid: json}';
        const cleanedJson = '{invalid: json}';
        const parseError = new Error('Unexpected token');
        const expectedResult = { invalid: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockImplementation(() => {
          throw parseError;
        });
        repairAndParse.mockResolvedValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(initialParse).toHaveBeenCalledWith(cleanedJson, mockLogger);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `parseAndRepair: Initial JSON.parse failed after cleaning. Attempting repair. Error: ${parseError.message}`,
          {
            originalInputLength: jsonString.length,
            cleanedJsonStringLength: cleanedJson.length,
            cleanedJsonPreview: cleanedJson.substring(0, 100),
            error: { message: parseError.message, name: parseError.name },
          }
        );
        expect(repairAndParse).toHaveBeenCalledWith(
          cleanedJson,
          mockLogger,
          undefined,
          parseError
        );
      });

      it('should truncate long JSON preview in warning log', async () => {
        // Arrange
        const jsonString = '{invalid: json}';
        const cleanedJson = 'a'.repeat(150); // 150 character string
        const parseError = new Error('Unexpected token');
        const expectedResult = { repaired: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockImplementation(() => {
          throw parseError;
        });
        repairAndParse.mockResolvedValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'parseAndRepair: Initial JSON.parse failed after cleaning'
          ),
          expect.objectContaining({
            cleanedJsonPreview: cleanedJson.substring(0, 100) + '...',
          })
        );
      });

      it('should pass dispatcher to repairAndParse when provided', async () => {
        // Arrange
        const jsonString = '{invalid: json}';
        const cleanedJson = '{invalid: json}';
        const parseError = new Error('Unexpected token');
        const expectedResult = { invalid: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockImplementation(() => {
          throw parseError;
        });
        repairAndParse.mockResolvedValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString, {
          logger: mockLogger,
          dispatcher: mockDispatcher,
        });

        // Assert
        expect(result).toEqual(expectedResult);
        expect(repairAndParse).toHaveBeenCalledWith(
          cleanedJson,
          mockLogger,
          mockDispatcher,
          parseError
        );
      });
    });

    describe('options handling', () => {
      it('should work with no options provided', async () => {
        // Arrange
        const jsonString = '{"valid": "json"}';
        const cleanedJson = '{"valid": "json"}';
        const expectedResult = { valid: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockReturnValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(ensureValidLogger).toHaveBeenCalledWith(
          undefined,
          'LlmJsonService'
        );
      });

      it('should use provided logger', async () => {
        // Arrange
        const jsonString = '{"valid": "json"}';
        const cleanedJson = '{"valid": "json"}';
        const expectedResult = { valid: 'json' };
        const customLogger = {
          debug: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockReturnValue(expectedResult);
        ensureValidLogger.mockReturnValue(customLogger);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString, {
          logger: customLogger,
        });

        // Assert
        expect(result).toEqual(expectedResult);
        expect(ensureValidLogger).toHaveBeenCalledWith(
          customLogger,
          'LlmJsonService'
        );
      });

      it('should handle empty options object', async () => {
        // Arrange
        const jsonString = '{"valid": "json"}';
        const cleanedJson = '{"valid": "json"}';
        const expectedResult = { valid: 'json' };

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockReturnValue(expectedResult);

        // Act
        const result = await llmJsonService.parseAndRepair(jsonString, {});

        // Assert
        expect(result).toEqual(expectedResult);
        expect(ensureValidLogger).toHaveBeenCalledWith(
          undefined,
          'LlmJsonService'
        );
      });
    });

    describe('error propagation', () => {
      it('should propagate JsonProcessingError from repairAndParse', async () => {
        // Arrange
        const jsonString = '{invalid: json}';
        const cleanedJson = '{invalid: json}';
        const parseError = new Error('Unexpected token');
        const repairError = new Error('Repair failed');
        repairError.name = 'JsonProcessingError';

        cleanLLMJsonOutput.mockReturnValue(cleanedJson);
        initialParse.mockImplementation(() => {
          throw parseError;
        });
        repairAndParse.mockRejectedValue(repairError);

        // Act & Assert
        await expect(llmJsonService.parseAndRepair(jsonString)).rejects.toThrow(
          'Repair failed'
        );
      });
    });
  });
});
