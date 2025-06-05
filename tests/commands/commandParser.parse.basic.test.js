// src/tests/commandParser.parse.basic.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../src/data/gameDataRepository.js'; // <--- CHANGE: Use named import
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock GameDataRepository ---
// Mock function for the specific method we need
const mockGetAllActionDefinitions = jest.fn();

// Mock the entire GameDataRepository module
jest.mock('../../src/data/gameDataRepository.js', () => {
  // Define the mock constructor function
  const MockGameDataRepository = jest.fn().mockImplementation(() => {
    // This is what the mock constructor will return when called with 'new'
    return {
      getAllActionDefinitions: mockGetAllActionDefinitions,
      // Add mocks for other methods if CommandParser constructor or other tests need them
      // For this specific test suite, only getAllActionDefinitions seems required by parse()
    };
  });
  // The factory function MUST return an object mapping named exports to their mocks
  return {
    GameDataRepository: MockGameDataRepository, // <--- CHANGE: Map the named export
  };
});

// --- Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing the parse method.
 * Includes actions needed for the test cases in this file.
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = Object.freeze([
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
]);

// --- Test Suite for Parse Method (Basic & Whitespace) ---
describe('CommandParser.parse() - Basic & Whitespace Tests', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Standard beforeEach Setup ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    // Also clear the mock constructor history itself if needed (though instance method calls are usually key)
    jest.clearAllMocks(); // Clears calls to mockGetAllActionDefinitions AND the mock constructor

    // Provide the mock return value (a fresh copy each time)
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository.
    // Because of the mock, 'GameDataRepository' now refers to MockGameDataRepository
    // Note: The real constructor takes arguments (registry, logger), but our mock doesn't need them
    // as we are manually defining the returned object structure.
    mockRepositoryInstance = new GameDataRepository(); // This calls the mock constructor

    // Instantiate the CommandParser with the *instance* returned by the mock repository constructor
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Test Cases (CPARSE-P-001 to CPARSE-P-008) ---

  // Test Case: CPARSE-P-001
  it('[CPARSE-P-001] should parse an empty string "" correctly (AC1, AC2, AC3)', () => {
    const input = '';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: null,
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    // AC3: Check if the relevant method on the *mock instance* was called
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-002
  it('[CPARSE-P-002] should parse a whitespace-only string " \\t " correctly (AC1, AC2, AC3)', () => {
    const input = ' \t ';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: null,
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-003
  it('[CPARSE-P-003] should parse " look" (leading whitespace) correctly (AC1, AC2, AC3)', () => {
    const input = ' look';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-004
  it('[CPARSE-P-004] should parse "look " (trailing whitespace) correctly (AC1, AC2, AC3)', () => {
    const input = 'look ';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-005
  it('[CPARSE-P-005] should parse " look " (leading/trailing whitespace) correctly (AC1, AC2, AC3)', () => {
    const input = ' look ';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-006
  it('[CPARSE-P-006] should parse "take the key" (internal whitespace in DO) correctly (AC1, AC2, AC3)', () => {
    const input = 'take the key';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      directObjectPhrase: 'the key', // Internal space preserved
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-007
  it('[CPARSE-P-007] should parse "put key on table" (V + DO + P + IO) correctly (AC1, AC2, AC3)', () => {
    const input = 'put key on table';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key',
      preposition: 'on',
      indirectObjectPhrase: 'table',
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });

  // Test Case: CPARSE-P-008
  it('[CPARSE-P-008] should parse "go > north" (V + P + IO) correctly (AC1, AC2, AC3)', () => {
    const input = 'go > north';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: null, // No DO before preposition
      preposition: '>',
      indirectObjectPhrase: 'north',
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // AC3
  });
});
