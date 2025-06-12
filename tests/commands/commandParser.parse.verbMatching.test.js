// src/tests/commandParser.parse.verbMatching.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import { freeze } from '../utils/objectUtils'; // <--- Use named import
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
    GameDataRepository: MockGameDataRepository, // <--- Map the named export
  };
});

// --- Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing the parse method.
 * Includes actions needed for the test cases in this file.
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = freeze([
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
]);

// --- Test Suite for Parse Method (Verb Matching & Case Sensitivity) ---
describe('CommandParser.parse() - Verb Matching & Case Sensitivity Tests', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Standard beforeEach Setup ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    jest.clearAllMocks(); // Clears calls to mockGetAllActionDefinitions AND the mock constructor

    // Provide the default mock return value (a fresh copy each time)
    // This setup is used by default unless overridden within a specific test
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository.
    mockRepositoryInstance = new GameDataRepository(); // This calls the mock constructor

    // Instantiate the CommandParser with the *instance* returned by the mock repository constructor
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Test Cases (CPARSE-P-010 to CPARSE-P-016) ---

  // Test Case: CPARSE-P-010
  it('[CPARSE-P-010] should parse "look" correctly (AC1, AC2)', () => {
    const input = 'look';
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
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-011
  it('[CPARSE-P-011] should parse "LOOK" correctly, demonstrating case-insensitivity (AC1, AC2, AC3)', () => {
    const input = 'LOOK';
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
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC3 confirmed by successful match despite case difference
  });

  // Test Case: CPARSE-P-012
  it('[CPARSE-P-012] should parse "lOoK" correctly, demonstrating case-insensitivity (AC1, AC2, AC3)', () => {
    const input = 'lOoK';
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
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC3 confirmed by successful match despite case difference
  });

  // Test Case: CPARSE-P-013
  it('[CPARSE-P-013] should return null actionId and error for unknown verb "fly" (AC1, AC2, AC4)', () => {
    const input = 'fly';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: null,
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: 'Internal Error: Command verb mismatch.', // As specified in CommandParser.js for verb mismatch
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC4 confirmed by null actionId and specific error message
  });

  // Test Case: CPARSE-P-014
  it('[CPARSE-P-014] should return null actionId and error for verb "openthe" (unknown verb before space) (AC1, AC2, AC4)', () => {
    const input = 'openthe door';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: null,
      directObjectPhrase: null, // Parsing stops after verb mismatch
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: 'Internal Error: Command verb mismatch.',
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC4 confirmed by null actionId and specific error message
  });

  // Test Case: CPARSE-P-015
  it('[CPARSE-P-015] should handle empty action definitions from repository (AC1, AC2, AC5)', () => {
    // Override the default mock return value for this specific test
    mockGetAllActionDefinitions.mockReturnValueOnce([]);

    const input = 'look';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: null,
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: 'Internal Error: Command verb mismatch.', // Verb 'look' is now unknown
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // Verify repository was called
    // AC5 confirmed by null actionId and error despite valid verb syntax

    // No explicit reset needed here, `mockReturnValueOnce` handles it.
    // The next test will use the default mock set in beforeEach.
  });

  // Test Case: CPARSE-P-016 (Optional)
  it('[CPARSE-P-016] should match the first definition when duplicate commandVerbs exist (Optional) (AC1, AC2)', () => {
    // Define mock actions with duplicate verbs for this test
    const duplicateVerbActions = [
      { id: 'plugin1:look', commandVerb: 'look', name: 'Look (Plugin 1)' },
      { id: 'core:go', commandVerb: 'go', name: 'Go' }, // Different verb
      { id: 'plugin2:look', commandVerb: 'look', name: 'Look (Plugin 2)' }, // Duplicate verb
    ];
    // Override the default mock return value
    mockGetAllActionDefinitions.mockReturnValueOnce(duplicateVerbActions);

    const input = 'look';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'plugin1:look', // Should match the *first* one encountered
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC2 - verify first match wins
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });
});
