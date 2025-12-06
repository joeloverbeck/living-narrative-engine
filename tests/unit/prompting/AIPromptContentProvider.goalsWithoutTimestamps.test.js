/**
 * @file Focused test for goals extraction bug fix
 * @description Tests the specific scenario where character goals have no timestamps
 * This test covers the bug where goals weren't appearing in prompts due to
 * timestamp requirements in the extraction logic.
 */

import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// ---- Mocks / Stubs ---- //
const makeDummyLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDummyPromptStaticContentService = () => ({
  getCoreTaskDescriptionText: () => 'task-content',
  getCharacterPortrayalGuidelines: (name) => `portray-${name}`,
  getNc21ContentPolicyText: () => 'policy-content',
  getFinalLlmInstructionText: () => 'instructions',
});

const makeDummyPerceptionLogFormatter = () => ({
  format: (entries) =>
    entries.map((e, i) => ({
      content: e.descriptionText || '',
      timestamp: e.timestamp || '',
      role: e.perceptionType || '',
      index: i,
    })),
});

const makeDummyGameStateValidationService = () => ({
  validate: () => ({ isValid: true, errorContent: null }),
});

const makeDummyActionCategorizationService = () => ({
  extractNamespace: jest.fn(),
  shouldUseGrouping: jest.fn(() => false),
  groupActionsByNamespace: jest.fn(() => new Map()),
  getSortedNamespaces: jest.fn(() => []),
  formatNamespaceDisplayName: jest.fn((namespace) => namespace),
});

const makeDummyCharacterDataXmlBuilder = () => ({
  buildCharacterDataXml: jest.fn(
    () => '<character_data>Mock XML</character_data>'
  ),
});

const makeDummyModActionMetadataProvider = () => ({
  getMetadataForMod: jest.fn(() => null),
});

// ---- Test Suite ---- //
describe('AIPromptContentProvider.getPromptData → Goals without timestamps bug fix', () => {
  let provider;
  let logger;

  beforeEach(() => {
    logger = makeDummyLogger();
    provider = new AIPromptContentProvider({
      logger,
      promptStaticContentService: makeDummyPromptStaticContentService(),
      perceptionLogFormatter: makeDummyPerceptionLogFormatter(),
      gameStateValidationService: makeDummyGameStateValidationService(),
      actionCategorizationService: makeDummyActionCategorizationService(),
      characterDataXmlBuilder: makeDummyCharacterDataXmlBuilder(),
      modActionMetadataProvider: makeDummyModActionMetadataProvider(),
    });
  });

  test('Goals from character definition should be extracted even without timestamps', async () => {
    // This is the exact structure from the sugar_mommy character definition
    const sugarMommyGoals = [
      {
        text: "I will cement myself as the indispensable face of Donostia's art film festivals - visibly steering funding panels, commanding introductions, claiming photographic prominence.",
      },
      {
        text: 'I must procure the perfect residence - my discretionary funds will manifest my architecture of control. Every view, every line, obsessively chosen to be my fortress.',
      },
      {
        text: "I want a handsome young man, perhaps even a teenage boy, to become mine. I will use my husband's wealth and my sexuality to keep my lover's attention, to ensure he is always available to me. And his passion, which will be mine to command, will make me feel alive again, and powerful.",
      },
    ];

    const gameStateDto = {
      actorPromptData: { name: 'Amaia Castillo' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'The Gilded Bean',
        description: 'A coffee shop terrace.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': { goals: sugarMommyGoals },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);

    // Verify goals are extracted correctly
    expect(Array.isArray(promptData.goalsArray)).toBe(true);
    expect(promptData.goalsArray).toHaveLength(3);

    // Verify exact content matches
    expect(promptData.goalsArray[0].text).toBe(
      "I will cement myself as the indispensable face of Donostia's art film festivals - visibly steering funding panels, commanding introductions, claiming photographic prominence."
    );
    expect(promptData.goalsArray[1].text).toBe(
      'I must procure the perfect residence - my discretionary funds will manifest my architecture of control. Every view, every line, obsessively chosen to be my fortress.'
    );
    expect(promptData.goalsArray[2].text).toBe(
      "I want a handsome young man, perhaps even a teenage boy, to become mine. I will use my husband's wealth and my sexuality to keep my lover's attention, to ensure he is always available to me. And his passion, which will be mine to command, will make me feel alive again, and powerful."
    );

    // Verify no timestamp fields are added when not present
    expect(promptData.goalsArray[0]).not.toHaveProperty('timestamp');
    expect(promptData.goalsArray[1]).not.toHaveProperty('timestamp');
    expect(promptData.goalsArray[2]).not.toHaveProperty('timestamp');
  });

  test('Goals array should not be empty when goals exist without timestamps', async () => {
    const gameStateDto = {
      actorPromptData: { name: 'Test Character' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Test Location',
        description: 'A test location.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': {
            goals: [{ text: 'Goal 1' }, { text: 'Goal 2' }],
          },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);

    // This test would have failed before the fix - goalsArray would be empty
    expect(promptData.goalsArray).toHaveLength(2);
    expect(promptData.goalsArray).toEqual([
      { text: 'Goal 1' },
      { text: 'Goal 2' },
    ]);

    // Verify logger was called with correct count
    expect(logger.debug).toHaveBeenCalledWith(
      'AIPromptContentProvider.getPromptData: goalsArray contains 2 entries.'
    );
  });

  test('Empty and malformed goals should still be filtered out correctly', async () => {
    const malformedGoals = [
      { text: 'Valid goal' },
      { text: '' }, // Empty text should be filtered out
      { text: '   ' }, // Whitespace-only text should be filtered out
      null, // Null entry should be filtered out
      { notText: 'Invalid structure' }, // Missing text field should be filtered out
      { text: 'Another valid goal' },
    ];

    const gameStateDto = {
      actorPromptData: { name: 'Test Character' },
      currentUserInput: '',
      perceptionLog: [],
      currentLocation: {
        name: 'Test Location',
        description: 'A test location.',
        exits: [],
        characters: [],
      },
      actorState: {
        components: {
          'core:short_term_memory': { thoughts: [] },
          'core:notes': { notes: [] },
          'core:goals': { goals: malformedGoals },
        },
      },
      availableActions: [],
    };

    const promptData = await provider.getPromptData(gameStateDto, logger);

    // Only the 2 valid goals should remain
    expect(promptData.goalsArray).toHaveLength(2);
    expect(promptData.goalsArray).toEqual([
      { text: 'Valid goal' },
      { text: 'Another valid goal' },
    ]);
  });
});
