// src/tests/logic/contextUtils.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { resolvePlaceholders } from '../../src/logic/contextUtils.js'; // Adjust path to your contextUtils.js
import resolvePath from '../../src/utils/resolvePath.js'; // Assuming resolvePath is used internally and correctly located

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
let mockLogger;

// Helper to create a standard mock executionContext structure
const createMockExecutionContext = (
  customContextVars = {},
  eventData = {},
  actorData = null,
  targetData = null
) => ({
  event: { type: 'mockEvent', payload: eventData },
  actor: actorData || {
    id: 'mockActor',
    name: 'ActorName',
    components: { stats: { health: 100 } },
  },
  target: targetData, // Will be null if not provided
  logger: mockLogger, // This logger is for the overall execution context if needed by deeper parts
  evaluationContext: {
    event: { type: 'mockEvent', payload: eventData }, // Often duplicated for jsonLogic
    actor: actorData || {
      id: 'mockActor',
      name: 'ActorName',
      components: { stats: { health: 100 } },
    }, // Also often duplicated
    target: targetData,
    context: {
      // This is the actual variable store for {context.varName}
      varA: 'valueA',
      numVar: 123,
      boolVar: true,
      nullVar: null,
      objVar: { nestedKey: 'nestedValue', otherNum: 456 },
      arrayVar: ['item1', { subItem: 'subValue' }],
      ...customContextVars,
    },
    globals: {}, // Assuming globals exist
    entities: {}, // Assuming entities exist
    logger: mockLogger, // This logger is part of the JsonLogicEvaluationContext
  },
});

// --- Test Suite ---
describe('resolvePlaceholders (contextUtils.js)', () => {
  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('1. Full String Placeholder Resolution ("{...}" entire string)', () => {
    test('1.1 should resolve `context.` path for a string variable', () => {
      const context = createMockExecutionContext();
      const input = '{context.varA}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe('valueA');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Resolved full string placeholder {context.varA} to: valueA'
        )
      );
    });

    test('1.2 should resolve `context.` path for a number variable (returns raw number)', () => {
      const context = createMockExecutionContext();
      const input = '{context.numVar}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(123);
    });

    test('1.3 should resolve `context.` path for a boolean variable (returns raw boolean)', () => {
      const context = createMockExecutionContext();
      const input = '{context.boolVar}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(true);
    });

    test('1.4 should resolve `context.` path for a null variable (returns raw null)', () => {
      const context = createMockExecutionContext();
      const input = '{context.nullVar}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBeNull();
    });

    test('1.5 should resolve `context.` path for an object variable (returns raw object)', () => {
      const context = createMockExecutionContext();
      const input = '{context.objVar}';
      expect(resolvePlaceholders(input, context, mockLogger)).toEqual({
        nestedKey: 'nestedValue',
        otherNum: 456,
      });
    });

    test('1.6 should resolve a nested `context.` path (e.g., {context.objVar.nestedKey})', () => {
      const context = createMockExecutionContext();
      const input = '{context.objVar.nestedKey}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'nestedValue'
      );
    });

    test('1.7 should resolve an `event.` path (e.g., {event.type})', () => {
      const context = createMockExecutionContext();
      const input = '{event.type}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe('mockEvent');
    });

    test('1.8 should resolve an `actor.` path (e.g., {actor.id})', () => {
      const context = createMockExecutionContext();
      const input = '{actor.id}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe('mockActor');
    });

    test('1.9 should resolve a nested `actor.` path (e.g., {actor.components.stats.health})', () => {
      const context = createMockExecutionContext();
      const input = '{actor.components.stats.health}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(100);
    });

    test('1.10 should return original string if `context.` path is not found and log warning', () => {
      const context = createMockExecutionContext();
      const input = '{context.nonExistentVar}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        '{context.nonExistentVar}'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Placeholder path "context.nonExistentVar" (interpreted as "nonExistentVar") from {context.nonExistentVar} could not be resolved.'
        )
      );
    });

    test('1.11 should return original string if `event.` path is not found and log warning', () => {
      const context = createMockExecutionContext();
      const input = '{event.nonExistentKey}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        '{event.nonExistentKey}'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Placeholder path "event.nonExistentKey" (interpreted as "event.nonExistentKey") from {event.nonExistentKey} could not be resolved.'
        )
      );
    });

    test('1.12 should return original string if `context.` path used but `evaluationContext.context` is missing, and log warning', () => {
      const context = createMockExecutionContext();
      delete context.evaluationContext.context; // Remove the variable store
      const input = '{context.varA}';
      const placeholderSyntax = input; // For top-level, fullLogPath is the syntax itself

      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        '{context.varA}'
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Ensure exactly two warnings
      expect(mockLogger.warn.mock.calls[0][0]).toBe(
        `Placeholder "context.varA" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${placeholderSyntax}`
      );
      expect(mockLogger.warn.mock.calls[1][0]).toBe(
        `Placeholder path "context.varA" (interpreted as "context.varA") from ${placeholderSyntax} could not be resolved. Path: ${placeholderSyntax}`
      );
    });

    test('1.13 should return original string if `context.` path used but `evaluationContext` is missing, and log warning', () => {
      const context = createMockExecutionContext();
      delete context.evaluationContext; // Remove evaluationContext entirely
      const input = '{context.varA}';
      const placeholderSyntax = input;

      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        '{context.varA}'
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Ensure exactly two warnings
      expect(mockLogger.warn.mock.calls[0][0]).toBe(
        `Placeholder "context.varA" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${placeholderSyntax}`
      );
      expect(mockLogger.warn.mock.calls[1][0]).toBe(
        `Placeholder path "context.varA" (interpreted as "context.varA") from ${placeholderSyntax} could not be resolved. Path: ${placeholderSyntax}`
      );
    });

    test('1.14 should return original string if executionContext itself is not an object, and log warning', () => {
      const input = '{context.varA}';
      expect(resolvePlaceholders(input, null, mockLogger)).toBe(
        '{context.varA}'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot resolve placeholder path "context.varA" from {context.varA}: executionContext is not a valid object.'
        )
      );
    });

    test('1.15 should handle placeholder paths with leading/trailing spaces inside braces', () => {
      const context = createMockExecutionContext();
      const input = '{  context.varA  }';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe('valueA');
    });
  });

  describe('2. Embedded Placeholder Resolution ("String with {...} in it")', () => {
    test('2.1 should resolve a single embedded `context.` placeholder', () => {
      const context = createMockExecutionContext();
      const input = 'Value is {context.varA}.';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Value is valueA.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Replaced embedded placeholder {context.varA} with string: "valueA"'
        )
      );
    });

    test('2.2 should resolve multiple embedded placeholders (context, event, actor)', () => {
      const context = createMockExecutionContext(
        { score: 9000 },
        { detail: 'urgent' }
      );
      const input =
        'Actor: {actor.name}, Event: {event.payload.detail}, Score: {context.score}, Num: {context.numVar}.';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Actor: ActorName, Event: urgent, Score: 9000, Num: 123.'
      );
    });

    test('2.3 should resolve embedded `context.` placeholder that is null', () => {
      const context = createMockExecutionContext();
      const input = 'This is {context.nullVar}.';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'This is null.'
      );
    });

    test('2.4 should resolve embedded `context.` placeholder that is an object (stringifies to [object Object])', () => {
      const context = createMockExecutionContext();
      const input = 'Object: {context.objVar}.';
      // Default String(object) is [object Object]
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Object: [object Object].'
      );
    });

    test('2.5 should resolve embedded `context.` placeholder that is an array (stringifies with commas)', () => {
      const context = createMockExecutionContext();
      const input = 'Array: {context.arrayVar}.';
      // Default String(array) joins with comma
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Array: item1,[object Object].'
      );
    });

    test('2.6 should handle mixed resolved and unresolved embedded placeholders', () => {
      const context = createMockExecutionContext();
      const input =
        'Found: {context.varA}, Missing: {context.nonExistent}, Event: {event.type}.';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Found: valueA, Missing: {context.nonExistent}, Event: mockEvent.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Embedded placeholder path "context.nonExistent" (interpreted as "nonExistent") from {context.nonExistent} could not be resolved.'
        )
      );
    });

    test('2.7 should handle embedded `context.` path when `evaluationContext.context` is missing, and log warning', () => {
      const context = createMockExecutionContext();
      delete context.evaluationContext.context;
      const input = 'Value: {context.varA}.';
      const placeholderSyntaxInLog = '{context.varA}'; // The syntax part of the log
      const fullLogPathForEmbedded = `${placeholderSyntaxInLog} (within string)`;

      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Value: {context.varA}.'
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Ensure exactly two warnings
      expect(mockLogger.warn.mock.calls[0][0]).toBe(
        `Embedded placeholder "context.varA" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${fullLogPathForEmbedded}`
      );
      expect(mockLogger.warn.mock.calls[1][0]).toBe(
        `Embedded placeholder path "context.varA" (interpreted as "context.varA") from ${placeholderSyntaxInLog} could not be resolved. Path: ${fullLogPathForEmbedded}`
      );
    });

    test('2.8 should not replace anything if no placeholders are present', () => {
      const context = createMockExecutionContext();
      const input = 'Just a plain string.';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'Just a plain string.'
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Replaced embedded placeholder')
      );
    });
  });

  describe('3. Recursive Resolution (Objects and Arrays as Input)', () => {
    test('3.1 should resolve placeholders in object values', () => {
      const context = createMockExecutionContext(
        { custom: 'customVal' },
        { data: 'eventData' }
      );
      const input = {
        key1: '{context.varA}',
        key2: 'Event is {event.payload.data}',
        key3: '{context.custom}',
      };
      const expected = {
        key1: 'valueA',
        key2: 'Event is eventData',
        key3: 'customVal',
      };
      expect(resolvePlaceholders(input, context, mockLogger)).toEqual(expected);
    });

    test('3.2 should resolve placeholders in array elements', () => {
      const context = createMockExecutionContext();
      const input = ['{context.varA}', '{event.type}', '{context.numVar}'];
      const expected = ['valueA', 'mockEvent', 123];
      expect(resolvePlaceholders(input, context, mockLogger)).toEqual(expected);
    });

    test('3.3 should resolve placeholders in nested objects and arrays', () => {
      const context = createMockExecutionContext({ nestedVal: 'deep' });
      const input = {
        level1: '{context.varA}',
        data: [
          '{event.type}',
          {
            item1: '{context.numVar}',
            item2: 'Value: {context.nestedVal}',
          },
        ],
        obj: {
          actorName: '{actor.name}',
        },
      };
      const expected = {
        level1: 'valueA',
        data: [
          'mockEvent',
          {
            item1: 123,
            item2: 'Value: deep',
          },
        ],
        obj: {
          actorName: 'ActorName',
        },
      };
      expect(resolvePlaceholders(input, context, mockLogger)).toEqual(expected);
    });

    test('3.4 should return original object/array if no changes were made', () => {
      const context = createMockExecutionContext();
      const inputObject = { key1: 'no placeholder', key2: 'another value' };
      expect(resolvePlaceholders(inputObject, context, mockLogger)).toBe(
        inputObject
      ); // Should be same instance

      const inputArray = ['plain', 'strings', 'only'];
      expect(resolvePlaceholders(inputArray, context, mockLogger)).toBe(
        inputArray
      ); // Should be same instance
    });
  });

  describe('4. Non-String/Object/Array Inputs', () => {
    test.each([
      [12345],
      [true],
      [false],
      [null],
      [undefined],
      [new Date()],
      [() => 'function'],
    ])(
      '4.1 should return input %p as is if it is not a string, array, or plain object',
      (inputValue) => {
        const context = createMockExecutionContext();
        expect(resolvePlaceholders(inputValue, context, mockLogger)).toBe(
          inputValue
        );
      }
    );
  });

  describe('5. Specific Scenarios from Original Bug Report', () => {
    test('5.1 should correctly resolve current_location_id from {context.actorPos.locId}', () => {
      const specificContext = createMockExecutionContext(
        { actorPos: { locId: 'isekai:adventurers_guild' } },
        { direction: 'out to town' }
      );
      const inputParams = {
        query_type: 'getTargetLocationForDirection',
        current_location_id: '{context.actorPos.locId}', // This becomes {context.actorPositionComponent.locationId} in rule
        direction_taken: '{event.payload.direction}',
      };
      const expectedParams = {
        query_type: 'getTargetLocationForDirection',
        current_location_id: 'isekai:adventurers_guild',
        direction_taken: 'out to town',
      };
      expect(
        resolvePlaceholders(inputParams, specificContext, mockLogger)
      ).toEqual(expectedParams);
    });

    test('5.2 should correctly resolve message string with {context.actorName.text} and {event.payload.direction}', () => {
      const specificContext = createMockExecutionContext(
        { actorName: { text: 'Hero' } },
        { direction: 'south' }
      );
      const inputMessage =
        '{context.actorName.text} tries to go {event.payload.direction}, but cannot find a path.';
      const expectedMessage = 'Hero tries to go south, but cannot find a path.';
      expect(
        resolvePlaceholders(inputMessage, specificContext, mockLogger)
      ).toBe(expectedMessage);
    });
  });

  describe('6. Edge case with placeholder path "context" (no dot)', () => {
    test('6.1 should resolve placeholder "{context}" from top-level if it exists', () => {
      const context = createMockExecutionContext();
      // Add a top-level 'context' property to the main executionContext
      context.context = 'This is a top-level context string';
      const input = '{context}';
      expect(resolvePlaceholders(input, context, mockLogger)).toBe(
        'This is a top-level context string'
      );
    });

    test('6.2 should resolve placeholder "{context.varA}" from nested evaluationContext.context even if top-level context exists', () => {
      const context = createMockExecutionContext();
      context.context = 'This is a top-level context string'; // Add a conflicting top-level 'context'
      const input = '{context.varA}'; // This should still refer to evaluationContext.context.varA
      expect(resolvePlaceholders(input, context, mockLogger)).toBe('valueA');
    });
  });
});
