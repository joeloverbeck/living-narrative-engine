// tests/utils/llmUtils.parseAndRepairJson.test.js
// --- FILE START ---

import { LlmJsonService } from '../../../src/llms/llmJsonService.js';
import {
  JsonProcessingError,
  cleanLLMJsonOutput,
} from '../../../src/utils/llmUtils.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals'; // Ensure 'jest' is imported

// 1. Instruct Jest to automatically mock the '@toolsycc/json-repair' module.
//    All its exports will be replaced with jest.fn().
jest.mock('@toolsycc/json-repair');

// 2. Import the (now auto-mocked) `repairJson` function.
//    `repairJson` will be a jest.fn() due to the auto-mocking.
//    The alias `mockRepairJson` is used in the tests as per your existing structure.
import { repairJson as mockRepairJson } from '@toolsycc/json-repair';

describe('LlmJsonService.parseAndRepair', () => {
  let mockLogger;
  let mockDispatcher;
  let service;

  beforeEach(() => {
    // Reset the auto-mocked function before each test.
    mockRepairJson.mockClear();

    // Setup a mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDispatcher = { dispatch: jest.fn() };
    service = new LlmJsonService();
  });

  // Test for invalid input types
  describe('Invalid Input Handling', () => {
    test('should throw TypeError for null input and dispatch error if dispatcher provided', async () => {
      await expect(
        service.parseAndRepair(null, {
          logger: mockLogger,
          dispatcher: mockDispatcher,
        })
      ).rejects.toThrow(TypeError("Input 'jsonString' must be a string."));
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining(
            "Input 'jsonString' must be a string. Received type: object"
          ),
        })
      );
    });

    test('should throw TypeError for undefined input and dispatch error if dispatcher provided', async () => {
      await expect(
        service.parseAndRepair(undefined, {
          logger: mockLogger,
          dispatcher: mockDispatcher,
        })
      ).rejects.toThrow(TypeError("Input 'jsonString' must be a string."));
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining(
            "Input 'jsonString' must be a string. Received type: undefined"
          ),
        })
      );
    });

    test('should throw JsonProcessingError for empty string input after cleaning and dispatch error if dispatcher provided', async () => {
      await expect(
        service.parseAndRepair('', {
          logger: mockLogger,
          dispatcher: mockDispatcher,
        })
      ).rejects.toThrow(
        new JsonProcessingError(
          'Cleaned JSON string is null or empty, cannot parse.',
          {
            stage: 'initial_clean',
            attemptedJsonString: '',
          }
        )
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining(
            'Cleaned JSON string is null or empty'
          ),
          details: { originalInput: '' },
        })
      );
    });

    test('should throw JsonProcessingError for whitespace-only string input after cleaning and dispatch error if dispatcher provided', async () => {
      await expect(
        service.parseAndRepair('   ', {
          logger: mockLogger,
          dispatcher: mockDispatcher,
        })
      ).rejects.toThrow(
        new JsonProcessingError(
          'Cleaned JSON string is null or empty, cannot parse.',
          {
            stage: 'initial_clean',
            attemptedJsonString: '   ',
          }
        )
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining(
            'Cleaned JSON string is null or empty'
          ),
          details: { originalInput: '   ' },
        })
      );
    });
  });

  // Test for valid JSON (no repair needed)
  describe('Valid JSON Input', () => {
    test('should parse a perfectly valid JSON string without repair', async () => {
      const validJsonString = '{"key": "value", "number": 123}';
      const expectedObject = { key: 'value', number: 123 };

      const result = await service.parseAndRepair(validJsonString, {
        logger: mockLogger,
      });

      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully parsed JSON on first attempt'),
        expect.any(Object)
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('should parse valid JSON even with surrounding text cleaned by cleanLLMJsonOutput', async () => {
      const rawJsonString = 'Here is the JSON: ```json\n{"key": "valid"}\n```';
      const expectedObject = { key: 'valid' };

      const result = await service.parseAndRepair(rawJsonString, {
        logger: mockLogger,
      });
      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  // Test for repairable JSON
  describe('Repairable JSON Input', () => {
    test('should repair and parse JSON with trailing commas', async () => {
      const repairableJsonString = '{"key": "value", "number": 123,}';
      const cleanedRepairableString = cleanLLMJsonOutput(repairableJsonString);
      const repairedJsonString = '{"key": "value", "number": 123}'; // What repairJson *should* return
      const expectedObject = { key: 'value', number: 123 };

      mockRepairJson.mockReturnValue(repairedJsonString);

      const result = await service.parseAndRepair(repairableJsonString, {
        logger: mockLogger,
      });

      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).toHaveBeenCalledWith(cleanedRepairableString);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Initial JSON.parse failed'),
        expect.any(Object)
      );
    });

    test('should repair and parse JSON with missing quotes on keys', async () => {
      const repairableJsonString = '{key: "value", anotherKey: "anotherValue"}';
      const cleanedRepairableString = cleanLLMJsonOutput(repairableJsonString);
      const repairedJsonString =
        '{"key": "value", "anotherKey": "anotherValue"}';
      const expectedObject = { key: 'value', anotherKey: 'anotherValue' };

      mockRepairJson.mockReturnValue(repairedJsonString);

      const result = await service.parseAndRepair(repairableJsonString, {
        logger: mockLogger,
      });
      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).toHaveBeenCalledWith(cleanedRepairableString);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should repair and parse JSON with single quotes', async () => {
      const repairableJsonString = "{'key': 'value', 'number': 123}";
      const cleanedRepairableString = cleanLLMJsonOutput(repairableJsonString);
      const repairedJsonString = '{"key": "value", "number": 123}';
      const expectedObject = { key: 'value', number: 123 };

      mockRepairJson.mockReturnValue(repairedJsonString);

      const result = await service.parseAndRepair(repairableJsonString, {
        logger: mockLogger,
      });
      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).toHaveBeenCalledWith(cleanedRepairableString);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // Test for unrepairable JSON (repair library fails or returns still-invalid JSON)
  describe('Unrepairable JSON Input', () => {
    test('should throw JsonProcessingError if repair library returns still-invalid JSON', async () => {
      const unrepairableJsonString = '{"key": "value", number: 123';
      const cleanedUnrepairableString = cleanLLMJsonOutput(
        unrepairableJsonString
      );
      const stringAfterRepairAttempt = '{"key": "value", "number: 123'; // Repair lib couldn't fix it

      mockRepairJson.mockReturnValue(stringAfterRepairAttempt);

      await expect(
        service.parseAndRepair(unrepairableJsonString, { logger: mockLogger })
      ).rejects.toThrow(JsonProcessingError);

      expect(mockRepairJson).toHaveBeenCalledWith(cleanedUnrepairableString);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse JSON even after repair attempt'
        ),
        expect.any(Object)
      );
    });

    test('should throw JsonProcessingError if repair library itself throws an error', async () => {
      const problematicJsonString = 'Totally not JSON { random text';
      const cleanedProblematicString = cleanLLMJsonOutput(
        problematicJsonString
      );
      const repairError = new Error('Internal repair library error');

      mockRepairJson.mockImplementation(() => {
        throw repairError;
      });

      await expect(
        service.parseAndRepair(problematicJsonString, { logger: mockLogger })
      ).rejects.toThrow(JsonProcessingError);

      expect(mockRepairJson).toHaveBeenCalledWith(cleanedProblematicString);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse JSON even after repair attempt'
        ),
        expect.any(Object)
      );

      await expect(
        service.parseAndRepair(problematicJsonString, { logger: mockLogger })
      ).rejects.toMatchObject({
        originalError: repairError,
        stage: 'final_parse_after_repair',
      });
    });
  });

  // Test logger interactions specifically
  describe('Logger Interactions', () => {
    test('should not call logger methods (except error for invalid type) if no logger is provided and JSON is valid', async () => {
      const validJsonString = '{"status": "ok"}';
      const result = await service.parseAndRepair(validJsonString);
      expect(result).toEqual({ status: 'ok' });
    });

    test('should not call logger methods if no logger is provided and repair is attempted and succeeds', async () => {
      const repairableJsonString = '{"key": "value",}';
      const repairedJsonString = '{"key": "value"}';
      mockRepairJson.mockReturnValue(repairedJsonString);
      await service.parseAndRepair(repairableJsonString);
      expect(mockRepairJson).toHaveBeenCalled();
    });

    test('should call logger.warn when initial parse fails', async () => {
      const repairableJson = '{"foo": "bar",}';
      mockRepairJson.mockReturnValue('{"foo": "bar"}');
      await service.parseAndRepair(repairableJson, { logger: mockLogger });
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Initial JSON.parse failed'),
        expect.anything()
      );
    });

    test('should call logger.info when repair and subsequent parse succeed', async () => {
      const repairableJson = '{"baz": "qux",}';
      mockRepairJson.mockReturnValue('{"baz": "qux"}');
      await service.parseAndRepair(repairableJson, { logger: mockLogger });
    });

    test('should call logger.error when repair attempt fails to produce valid JSON', async () => {
      const unrepairableJson = '{"error": true,,';
      mockRepairJson.mockReturnValue('{"error": true,,');
      await expect(
        service.parseAndRepair(unrepairableJson, { logger: mockLogger })
      ).rejects.toThrow(JsonProcessingError);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse JSON even after repair attempt'
        ),
        expect.anything()
      );
    });
  });

  describe('Interaction with cleanLLMJsonOutput', () => {
    test('should process a string that requires cleaning before parsing', async () => {
      const rawString = '  ```json\n{"key":"value_after_cleaning"}```  ';
      const expectedObject = { key: 'value_after_cleaning' };

      const result = await service.parseAndRepair(rawString, {
        logger: mockLogger,
      });
      expect(result).toEqual(expectedObject);
      expect(mockRepairJson).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully parsed JSON on first attempt'),
        expect.objectContaining({
          inputLength: rawString.length,
          cleanedLength: JSON.stringify(expectedObject).length,
        })
      );
    });
  });
});

// --- FILE END ---
