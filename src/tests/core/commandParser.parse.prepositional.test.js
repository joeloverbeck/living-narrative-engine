// src/tests/commandParser.parse.prepositional.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../core/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../core/services/gameDataRepository.js'; // Use named import
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock GameDataRepository ---
// Mock function for the specific method we need
const mockGetAllActionDefinitions = jest.fn();

// Mock the entire GameDataRepository module
jest.mock('../../core/services/gameDataRepository.js', () => {
  // Define the mock constructor function
  const MockGameDataRepository = jest.fn().mockImplementation(() => {
    // This is what the mock constructor will return when called with 'new'
    return {
      getAllActionDefinitions: mockGetAllActionDefinitions
      // Add mocks for other methods if CommandParser constructor or other tests need them
    };
  });
    // The factory function MUST return an object mapping named exports to their mocks
  return {
    GameDataRepository: MockGameDataRepository // Map the named export
  };
});

// --- Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing the parse method.
 * Includes actions needed for the V+P+IO and V+DO+P+IO test cases.
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = Object.freeze([
  // Actions required by the tests in this file (Ticket 6)
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
  { id: 'core:use', commandVerb: 'use', name: 'Use' },
  { id: 'core:talk', commandVerb: 'talk', name: 'Talk' }, // Added for CPARSE-P-029
  // Include others from previous examples for broader context if needed
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:read', commandVerb: 'read', name: 'Read' },
]);

// --- Test Suite for Parse Method (V+P+IO and V+DO+P+IO Structures) ---
describe('CommandParser.parse() - Prepositional Structure Tests (V+P+IO, V+DO+P+IO)', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Standard beforeEach Setup (From Ticket 1) ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    jest.clearAllMocks(); // Clears calls to mockGetAllActionDefinitions AND the mock constructor

    // Provide the default mock return value (a fresh copy each time)
    // Ensures this suite uses the actions defined above.
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository.
    mockRepositoryInstance = new GameDataRepository(); // Calls the mock constructor

    // Instantiate the CommandParser with the *instance* returned by the mock repository constructor
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Test Cases (CPARSE-P-023 to CPARSE-P-032) ---

  // Test Case: CPARSE-P-023 (V+DO+P+IO - Single Words)
  it('[CPARSE-P-023] should parse "put key in box" correctly (V+DO+P+IO)', () => {
    const input = 'put key in box';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key',
      preposition: 'in',
      indirectObjectPhrase: 'box',
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, DO, P, IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-024 (V+DO+P+IO - Multi-Word)
  it('[CPARSE-P-024] should parse "put the blue gem on stone altar" correctly (V+DO+P+IO, multi-word)', () => {
    const input = 'put the blue gem on stone altar';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'the blue gem',
      preposition: 'on',
      indirectObjectPhrase: 'stone altar',
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, DO, P, IO
    // AC3: Verify multi-word DO and IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-025 (V+P+IO - Single Word IO)
  it('[CPARSE-P-025] should parse "look at door" correctly (V+P+IO)', () => {
    const input = 'look at door';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null, // V+P+IO has null DO
      preposition: 'at',
      indirectObjectPhrase: 'door',
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, null DO, P, IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-026 (V+P+IO - Special Preposition, Multi-Word IO)
  it('[CPARSE-P-026] should parse "go > the dark cave" correctly (V+P+IO, special prep)', () => {
    const input = 'go > the dark cave';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: null, // V+P+IO has null DO
      preposition: '>',
      indirectObjectPhrase: 'the dark cave',
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, null DO, P ('>'), IO
    // AC3: Verify multi-word IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-027 (V+DO+P+IO - Special Preposition)
  it('[CPARSE-P-027] should parse "use key > lock" correctly (V+DO+P+IO, special prep)', () => {
    const input = 'use key > lock';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:use',
      directObjectPhrase: 'key',
      preposition: '>',
      indirectObjectPhrase: 'lock',
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, DO, P ('>'), IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-029 (V+DO+P+IO - Complex IO Phrase)
  // The first preposition ('with') determines the split.
  it('[CPARSE-P-029] should parse "talk guard with helmet about task" correctly (V+DO+P+IO, complex IO)', () => {
    const input = 'talk guard with helmet about task';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:talk',
      directObjectPhrase: 'guard',
      preposition: 'with', // First preposition found
      indirectObjectPhrase: 'helmet about task', // Remainder after 'with'
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, DO, P, complex IO
    // AC3: Verify single-word DO, multi-word IO
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-030 (V+P+IO - Complex IO Phrase with internal preposition)
  it('[CPARSE-P-030] should parse "look in box with lid" correctly (V+P+IO, complex IO)', () => {
    const input = 'look in box with lid';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null, // V+P+IO has null DO
      preposition: 'in', // First preposition found
      indirectObjectPhrase: 'box with lid', // Remainder after 'in'
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, null DO, P, complex IO
    // AC3: Verify multi-word IO containing another preposition
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-031 (V+P - Missing IO)
  it('[CPARSE-P-031] should parse "look in" correctly (V+P, missing IO)', () => {
    const input = 'look in';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null, // V+P structure
      preposition: 'in',
      indirectObjectPhrase: null, // IO is missing
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, null DO, P, null IO
    // AC4: Confirm missing IO results in null IO phrase
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-032 (V+DO+P - Missing IO)
  it('[CPARSE-P-032] should parse "put key on" correctly (V+DO+P, missing IO)', () => {
    const input = 'put key on';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key',
      preposition: 'on',
      indirectObjectPhrase: null, // IO is missing
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId, DO, P, null IO
    // AC4: Confirm missing IO results in null IO phrase
    // AC5: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // --- Additional edge case tests ---

  it('should handle extra spaces around preposition in V+DO+P+IO correctly', () => {
    const input = 'put  key   on   table';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key', // Assumes internal spaces before prep are trimmed as part of DO
      preposition: 'on',
      indirectObjectPhrase: 'table', // Assumes leading spaces before IO are trimmed
      originalInput: input,
      error: null
    };
    // Verification based on CommandParser logic:
    // textAfterCommand = "  key   on   table"
    // firstMatchIndex = position of 'on' (approx 8)
    // textBeforePrep = "  key   ".substring(0, 8).trimEnd() => "  key" (or maybe "key" depending on precise index)
    // textAfterPrep = "  key   on   table".substring(8 + 2).trimStart() => "   table".trimStart() => "table"
    // Let's re-run with exact logic:
    // textAfterCommand = "key   on   table" (after verb 'put' removed and trimmed)
    // firstMatchIndex = index of 'on' in "key   on   table" which is 6
    // firstMatchPrep = 'on', firstMatchLength = 2
    // textBeforePrep = "key   on   table".substring(0, 6).trimEnd() => "key   ".trimEnd() => "key"
    // textAfterPrep = "key   on   table".substring(6 + 2).trimStart() => "   table".trimStart() => "table"
    // Looks correct.

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should handle extra spaces around preposition in V+P+IO correctly', () => {
    const input = 'look   at   door';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: 'at',
      indirectObjectPhrase: 'door',
      originalInput: input,
      error: null
    };
    // Verification:
    // textAfterCommand = "  at   door" (after verb 'look' removed and trimmed)
    // firstMatchIndex = index of 'at' in "  at   door" which is 2
    // firstMatchPrep = 'at', firstMatchLength = 2
    // textBeforePrep = "  at   door".substring(0, 2).trimEnd() => "  ".trimEnd() => "" => null DO
    // textAfterPrep = "  at   door".substring(2 + 2).trimStart() => "   door".trimStart() => "door"
    // Looks correct.

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should handle preposition as the last word in the input (V+DO+P)', () => {
    // Already covered by CPARSE-P-032, just confirming name logic
    const input = 'put key with';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key',
      preposition: 'with',
      indirectObjectPhrase: null, // IO is missing
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should handle preposition as the last word in the input (V+P)', () => {
    // Already covered by CPARSE-P-031, just confirming name logic
    const input = 'look at';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: 'at',
      indirectObjectPhrase: null, // IO is missing
      originalInput: input,
      error: null
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

});