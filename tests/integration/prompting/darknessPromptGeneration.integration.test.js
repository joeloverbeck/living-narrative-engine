// tests/integration/prompting/darknessPromptGeneration.integration.test.js

import { describe, it, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import ActionCategorizationService from '../../../src/entities/utils/ActionCategorizationService.js';
import { PRESENCE_MESSAGES } from '../../../src/domUI/location/presenceMessageBuilder.js';

/**
 * Creates a mock logger for testing.
 * @returns {object} Mock logger with jest functions
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a game state DTO with a dark location.
 * @param {object} options - Configuration options
 * @param {boolean} [options.isLit=false] - Whether location is lit
 * @param {string|null} [options.descriptionInDarkness=null] - Sensory description
 * @param {Array} [options.characters=[]] - Characters in location
 * @param {Array} [options.exits=[]] - Exits from location
 * @returns {object} Game state DTO for testing
 */
function createDarkLocationGameState({
  isLit = false,
  descriptionInDarkness = null,
  characters = [],
  exits = [],
} = {}) {
  return {
    actorPromptData: {
      name: 'Test Explorer',
      description: 'A brave adventurer exploring dark places.',
      personality: 'Cautious but determined.',
    },
    currentUserInput: 'What do I sense around me?',
    perceptionLog: [],
    currentLocation: {
      name: 'The Abandoned Mine',
      description:
        'A dark mine shaft with crumbling wooden supports and scattered debris.',
      isLit,
      descriptionInDarkness,
      characters,
      exits,
    },
    actorState: {
      components: {},
    },
  };
}

/**
 * Creates a mock safe event dispatcher for testing.
 * @returns {object} Mock event dispatcher
 */
function createMockEventDispatcher() {
  return {
    dispatch: jest.fn(),
  };
}

/**
 * Creates a mock static content service for testing.
 * @returns {object} Mock static content service
 */
function createMockStaticContentService() {
  return {
    getCoreTaskDescriptionText: jest.fn(() => 'Core Task: Test task.'),
    getCharacterPortrayalGuidelines: jest.fn(() => 'Guidelines: Test guidelines.'),
    getNc21ContentPolicyText: jest.fn(() => 'Policy: Test policy.'),
    getFinalLlmInstructionText: jest.fn(() => 'Final Instructions: Test.'),
  };
}

/**
 * Creates a mock character data XML builder for testing.
 * @returns {object} Mock XML builder
 */
function createMockCharacterDataXmlBuilder() {
  return {
    buildCharacterDataXml: jest.fn((actorPromptData) => {
      const name = actorPromptData?.name || 'Unknown';
      return `<character_data><identity>YOU ARE ${name}.</identity></character_data>`;
    }),
  };
}

/**
 * Creates a mock mod action metadata provider for testing.
 * @returns {object} Mock metadata provider
 */
function createMockModActionMetadataProvider() {
  return {
    getMetadataForMod: jest.fn(() => null),
  };
}

/**
 * Creates a minimal AIPromptContentProvider for integration testing.
 * @returns {object} Contains provider and dependencies
 */
function createContentProvider() {
  const logger = createLogger();
  const safeEventDispatcher = createMockEventDispatcher();

  const actionCategorizationService = new ActionCategorizationService({
    logger,
  });

  const perceptionLogFormatter = new PerceptionLogFormatter({
    logger,
  });

  const gameStateValidationService = new GameStateValidationServiceForPrompting(
    { logger, safeEventDispatcher }
  );

  const provider = new AIPromptContentProvider({
    logger,
    promptStaticContentService: createMockStaticContentService(),
    perceptionLogFormatter,
    gameStateValidationService,
    actionCategorizationService,
    characterDataXmlBuilder: createMockCharacterDataXmlBuilder(),
    modActionMetadataProvider: createMockModActionMetadataProvider(),
  });

  return { provider, logger };
}

describe('Darkness Prompt Generation Integration', () => {
  describe('complete prompt generation for dark location', () => {
    it('should generate darkness-specific world context when location isLit is false', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({ isLit: false });

      const result = provider.getWorldContextContent(gameState);

      // Should contain darkness-specific structure
      expect(result).toContain('## Current Situation');
      expect(result).toContain('### Location');
      expect(result).toContain('The Abandoned Mine');
      expect(result).toContain('### Conditions');
      expect(result).toContain('**Pitch darkness.** You cannot see anything.');
      expect(result).toContain('## Exits from Current Location');
      expect(result).toContain('You cannot see any exits in the darkness.');
      expect(result).toContain('## Other Presences');
    });

    it('should generate standard world context when location isLit is true', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: true,
        characters: [],
        exits: [{ direction: 'north', targetLocationName: 'Surface' }],
      });

      const result = provider.getWorldContextContent(gameState);

      // Should NOT contain darkness-specific content
      expect(result).not.toContain('**Pitch darkness.**');
      expect(result).not.toContain('You cannot see any exits in the darkness.');

      // Should contain standard location content
      expect(result).toContain('The Abandoned Mine');
    });

    it('should generate standard world context when isLit is undefined (backward compat)', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState();
      // Remove isLit to simulate old DTO format
      delete gameState.currentLocation.isLit;

      const result = provider.getWorldContextContent(gameState);

      // Should treat as lit (backward compatibility)
      expect(result).not.toContain('**Pitch darkness.**');
      expect(result).not.toContain('You cannot see any exits in the darkness.');
    });
  });

  describe('no character details leak into darkness prompt', () => {
    it('should not include character names in darkness context', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters: [
          { id: 'char1', name: 'Goroth the Destroyer', description: 'A hulking figure with battle scars.' },
          { id: 'char2', name: 'Lady Evelyn', description: 'A noble woman in fine attire.' },
        ],
      });

      const result = provider.getWorldContextContent(gameState);

      // Character names should NOT appear
      expect(result).not.toContain('Goroth the Destroyer');
      expect(result).not.toContain('Lady Evelyn');
      // Character descriptions should NOT appear
      expect(result).not.toContain('hulking figure');
      expect(result).not.toContain('noble woman');
      expect(result).not.toContain('battle scars');
      expect(result).not.toContain('fine attire');
    });

    it('should not include character age information in darkness context', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters: [
          {
            id: 'char1',
            name: 'Elder Sage',
            apparentAge: { minAge: 60, maxAge: 80, bestGuess: 70 },
          },
        ],
      });

      const result = provider.getWorldContextContent(gameState);

      // Age information should NOT appear
      expect(result).not.toContain('Elder Sage');
      expect(result).not.toContain('60');
      expect(result).not.toContain('70');
      expect(result).not.toContain('80');
      expect(result).not.toMatch(/apparent age/i);
    });

    it('should use presence count, not identities', () => {
      const { provider } = createContentProvider();
      const characters = [
        { id: 'char1', name: 'Character One' },
        { id: 'char2', name: 'Character Two' },
        { id: 'char3', name: 'Character Three' },
      ];
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters,
      });

      const result = provider.getWorldContextContent(gameState);

      // Should contain presence message for 3 characters (FEW)
      expect(result).toContain(PRESENCE_MESSAGES.FEW);
      // Should NOT contain any individual character names
      characters.forEach((char) => {
        expect(result).not.toContain(char.name);
      });
    });
  });

  describe('no exit information in darkness prompt', () => {
    it('should not include exit directions in darkness context', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        exits: [
          { direction: 'north', targetLocationName: 'Surface Entrance' },
          { direction: 'south', targetLocationName: 'Deep Cavern' },
          { direction: 'west', targetLocationName: 'Side Tunnel' },
        ],
      });

      const result = provider.getWorldContextContent(gameState);

      // Exit directions should NOT appear
      expect(result).not.toContain('north');
      expect(result).not.toContain('south');
      expect(result).not.toContain('west');
      // Target locations should NOT appear
      expect(result).not.toContain('Surface Entrance');
      expect(result).not.toContain('Deep Cavern');
      expect(result).not.toContain('Side Tunnel');
      // Should contain generic darkness message instead
      expect(result).toContain('You cannot see any exits in the darkness.');
    });

    it('should not contain "leads to" pattern in darkness context', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        exits: [{ direction: 'east', targetLocationName: 'Garden' }],
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).not.toMatch(/leads to/i);
      expect(result).not.toMatch(/towards/i);
    });
  });

  describe('presence message is included correctly', () => {
    it('should include NONE presence message for 0 characters', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters: [],
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).toContain(PRESENCE_MESSAGES.NONE);
    });

    it('should include ONE presence message for 1 character', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters: [{ id: 'char1', name: 'Someone' }],
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).toContain(PRESENCE_MESSAGES.ONE);
    });

    it('should include FEW presence message for 2-3 characters', () => {
      const { provider } = createContentProvider();

      // Test with 2 characters
      const gameState2 = createDarkLocationGameState({
        isLit: false,
        characters: [
          { id: 'char1', name: 'A' },
          { id: 'char2', name: 'B' },
        ],
      });
      expect(provider.getWorldContextContent(gameState2)).toContain(
        PRESENCE_MESSAGES.FEW
      );

      // Test with 3 characters
      const gameState3 = createDarkLocationGameState({
        isLit: false,
        characters: [
          { id: 'char1', name: 'A' },
          { id: 'char2', name: 'B' },
          { id: 'char3', name: 'C' },
        ],
      });
      expect(provider.getWorldContextContent(gameState3)).toContain(
        PRESENCE_MESSAGES.FEW
      );
    });

    it('should include SEVERAL presence message for 4+ characters', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        characters: [
          { id: 'char1', name: 'A' },
          { id: 'char2', name: 'B' },
          { id: 'char3', name: 'C' },
          { id: 'char4', name: 'D' },
        ],
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).toContain(PRESENCE_MESSAGES.SEVERAL);
    });
  });

  describe('sensory description handling', () => {
    it('should include custom sensory description when provided', () => {
      const { provider } = createContentProvider();
      const sensoryDescription =
        'The air is thick with the smell of damp stone and decay. You hear water dripping in the distance.';
      const gameState = createDarkLocationGameState({
        isLit: false,
        descriptionInDarkness: sensoryDescription,
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).toContain('### Sensory Impressions');
      expect(result).toContain(sensoryDescription);
    });

    it('should omit sensory section when no description provided', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        descriptionInDarkness: null,
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).not.toContain('### Sensory Impressions');
    });

    it('should omit sensory section for empty string description', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        descriptionInDarkness: '',
      });

      const result = provider.getWorldContextContent(gameState);

      expect(result).not.toContain('### Sensory Impressions');
    });
  });

  describe('section ordering in darkness context', () => {
    it('should produce sections in correct order', () => {
      const { provider } = createContentProvider();
      const gameState = createDarkLocationGameState({
        isLit: false,
        descriptionInDarkness: 'You smell musty air.',
        characters: [{ id: 'char1', name: 'Someone' }],
      });

      const result = provider.getWorldContextContent(gameState);
      const lines = result.split('\n');

      // Find section positions
      const currentSituationIdx = lines.indexOf('## Current Situation');
      const locationIdx = lines.indexOf('### Location');
      const conditionsIdx = lines.indexOf('### Conditions');
      const sensoryIdx = lines.indexOf('### Sensory Impressions');
      const exitsIdx = lines.indexOf('## Exits from Current Location');
      const presencesIdx = lines.indexOf('## Other Presences');

      // Verify correct order
      expect(currentSituationIdx).toBeGreaterThan(-1);
      expect(currentSituationIdx).toBeLessThan(locationIdx);
      expect(locationIdx).toBeLessThan(conditionsIdx);
      expect(conditionsIdx).toBeLessThan(sensoryIdx);
      expect(sensoryIdx).toBeLessThan(exitsIdx);
      expect(exitsIdx).toBeLessThan(presencesIdx);
    });
  });
});
