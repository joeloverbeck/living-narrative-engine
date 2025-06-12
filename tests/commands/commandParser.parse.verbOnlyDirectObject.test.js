// src/tests/commandParser.parse.verbOnlyDirectObject.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import { freeze } from '../utils/objectUtils'; // Use named import
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
    };
  });
  // The factory function MUST return an object mapping named exports to their mocks
  return {
    GameDataRepository: MockGameDataRepository, // Map the named export
  };
});

// --- Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing the parse method.
 * Includes actions needed for the test cases in this file (inventory, take, read).
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = freeze([
  // Actions required by the tests in this file
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:read', commandVerb: 'read', name: 'Read' },
  // Include others from previous examples for completeness, though not strictly necessary here
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
]);

// --- Test Suite for Parse Method (Verb-Only and Verb+DirectObject) ---
describe('CommandParser.parse() - Verb-Only and Verb+DirectObject Tests', () => {
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

  // --- Test Cases (CPARSE-P-020 to CPARSE-P-028 focus) ---

  // Test Case: CPARSE-P-020
  it('[CPARSE-P-020] should parse "inventory" correctly (V-Only)', () => {
    const input = 'inventory';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:inventory',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId and null DO/P/IO
    // AC3: Verify null P/IO
    // AC4: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // Verify repository interaction
  });

  // Test Case: CPARSE-P-021
  it('[CPARSE-P-021] should parse "take map" correctly (V+DO single word)', () => {
    const input = 'take map';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      directObjectPhrase: 'map',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId and DO phrase
    // AC3: Verify null P/IO
    // AC4: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-022
  it('[CPARSE-P-022] should parse "take the rusty key" correctly (V+DO multi-word)', () => {
    const input = 'take the rusty key';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      directObjectPhrase: 'the rusty key',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    // AC2: Verify actionId and DO phrase
    // AC3: Verify null P/IO
    // AC4: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-028
  it('[CPARSE-P-028] should parse "read note about dragons" correctly (V+DO multi-word, includes potential preposition)', () => {
    const input = 'read note about dragons';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:read',
      directObjectPhrase: 'note about dragons', // Ensure "about" is part of DO, not P
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    // Ensure the 'read' action is available in the mock data
    expect(MOCK_ACTIONS.some((action) => action.id === 'core:read')).toBe(true);

    const result = commandParser.parse(input);

    // AC2: Verify actionId and DO phrase (including "about")
    // AC3: Verify null P/IO
    // AC4: Verify null error
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // --- Additional tests for edge cases related to V/V+DO ---

  it('should handle V+DO with extra trailing whitespace correctly', () => {
    const input = 'take map  ';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      directObjectPhrase: 'map', // Trailing whitespace on DO should be trimmed by parser logic
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should handle V+DO with extra internal whitespace correctly', () => {
    const input = 'take  the   rusty key'; // Extra spaces within DO
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      // The current parser logic (splitting by /\s+/) should handle this,
      // but the reconstruction might or might not preserve multiple spaces depending on implementation.
      // Based on the provided parser code, it uses substring/trim, so multiple internal spaces *should* be preserved.
      // Let's assume the desired behavior is to preserve internal spacing as typed after the verb.
      // The parser code uses `textAfterCommand = remainingText.trimStart();` and then `textAfterCommand.trimEnd()`
      // if no preposition is found. This preserves internal multi-spaces.
      directObjectPhrase: 'the   rusty key',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should handle V-Only command with trailing whitespace correctly', () => {
    const input = 'inventory ';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:inventory',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });
});
