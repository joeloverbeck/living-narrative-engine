/**
 * @file AI Prompt Output Regression Tests
 * Validates LLM prompt compatibility and enhancement
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('AI Prompt Output Regression', () => {
  let container;
  let promptContentProvider;

  beforeEach(async () => {
    // Create container with action categorization support
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register logger first (required by action categorization service)
    const appLogger = new ConsoleLogger(LogLevel.ERROR); // Use ERROR level to reduce noise
    registrar.instance(tokens.ILogger, appLogger);

    // Register required dependencies for base container
    container.register(
      tokens.ISafeEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    container.register(
      tokens.IValidatedEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    // Configure base container which includes action categorization
    await configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });

    promptContentProvider = new AIPromptContentProvider({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      promptStaticContentService: {
        getCoreTaskDescriptionText: () => 'Core task description',
        getCharacterPortrayalGuidelines: () => 'Character guidelines',
        getNc21ContentPolicyText: () => 'Content policy',
        getFinalLlmInstructionText: () => 'Final instructions',
      },
      perceptionLogFormatter: { format: () => 'Formatted perception log' },
      gameStateValidationService: { validate: () => ({ isValid: true }) },
      actionCategorizationService: container.resolve(
        tokens.IActionCategorizationService
      ),
      characterDataXmlBuilder: {
        buildCharacterDataXml: () => '<character>Mock XML</character>',
      },
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing output format for insufficient actions', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait for a moment.',
          },
          {
            index: 2,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss gently.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Should use flat format (original behavior)
      expect(result).toContain(
        'Choose one of the following available actions by its index'
      );
      expect(result).toContain(
        '[Index: 1] Command: "wait". Description: Wait for a moment.'
      );
      expect(result).toContain(
        '[Index: 2] Command: "kiss". Description: Kiss gently.'
      );

      // Should NOT contain categorization headers
      expect(result).not.toContain('## Available Actions');
      expect(result).not.toContain('### CORE Actions');
    });

    it('should preserve action indexes exactly', () => {
      const gameState = {
        availableActions: [
          {
            index: 5,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
          },
          {
            index: 1,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss.',
          },
          {
            index: 3,
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Go.',
          },
          {
            index: 7,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove.',
          },
          {
            index: 2,
            actionId: 'affection:hug',
            commandString: 'hug',
            description: 'Hug.',
          },
          {
            index: 9,
            actionId: 'anatomy:touch',
            commandString: 'touch',
            description: 'Touch.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // All original indexes should be preserved
      expect(result).toContain('[Index: 5]');
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 3]');
      expect(result).toContain('[Index: 7]');
      expect(result).toContain('[Index: 2]');
      expect(result).toContain('[Index: 9]');
    });

    it('should handle empty actions gracefully', () => {
      const gameState = { availableActions: [] };
      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toBe(
        'You have no specific actions immediately apparent. Consider what your character would do in this situation; you might wait, observe, or reflect.'
      );
    });

    it('should handle missing availableActions property', () => {
      const gameState = {};
      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toBe(
        'You have no specific actions immediately apparent. Consider what your character would do in this situation; you might wait, observe, or reflect.'
      );
    });
  });

  describe('Enhanced Categorization Output', () => {
    it('should provide categorized output when thresholds met', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait patiently.',
          },
          {
            index: 2,
            actionId: 'movement:go',
            commandString: 'go north',
            description: 'Move to the north.',
          },
          {
            index: 3,
            actionId: 'kissing:kiss',
            commandString: 'kiss Sarah',
            description: 'Kiss Sarah tenderly.',
          },
          {
            index: 4,
            actionId: 'affection:hug',
            commandString: 'hug Sarah',
            description: 'Give Sarah a warm hug.',
          },
          {
            index: 5,
            actionId: 'clothing:remove',
            commandString: 'remove shirt',
            description: 'Remove your shirt.',
          },
          {
            index: 6,
            actionId: 'anatomy:touch',
            commandString: 'touch face',
            description: 'Gently touch face.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Should use categorized format
      expect(result).toContain('## Available Actions');
      expect(result).toContain('### CORE Actions');
      expect(result).toContain('### KISSING Actions');
      expect(result).toContain('### CLOTHING Actions');
      expect(result).toContain('### ANATOMY Actions');

      // Should maintain all action details
      expect(result).toContain(
        '[Index: 1] Command: "wait". Description: Wait patiently.'
      );
      expect(result).toContain(
        '[Index: 3] Command: "kiss Sarah". Description: Kiss Sarah tenderly.'
      );
    });

    it('should respect namespace priority order', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'clothing:wear',
            commandString: 'wear',
            description: 'Wear clothing.',
          },
          {
            index: 2,
            actionId: 'anatomy:examine',
            commandString: 'examine',
            description: 'Examine anatomy.',
          },
          {
            index: 3,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait patiently.',
          },
          {
            index: 4,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss gently.',
          },
          {
            index: 5,
            actionId: 'sex:initiate',
            commandString: 'initiate',
            description: 'Initiate intimacy.',
          },
          {
            index: 6,
            actionId: 'unknown:action',
            commandString: 'unknown',
            description: 'Unknown action.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Verify namespace order: core, affection, kissing, caressing, sex, anatomy, clothing, then alphabetical
      const coreIndex = result.indexOf('### CORE Actions');
      const kissingIndex = result.indexOf('### KISSING Actions');
      const sexIndex = result.indexOf('### SEX Actions');
      const anatomyIndex = result.indexOf('### ANATOMY Actions');
      const clothingIndex = result.indexOf('### CLOTHING Actions');
      const unknownIndex = result.indexOf('### OTHER Actions');

      expect(coreIndex).toBeLessThan(kissingIndex);
      expect(kissingIndex).toBeLessThan(sexIndex);
      expect(sexIndex).toBeLessThan(anatomyIndex);
      expect(anatomyIndex).toBeLessThan(clothingIndex);
      expect(clothingIndex).toBeLessThan(unknownIndex);
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle actions with missing or malformed data', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
          },
          {
            index: 2,
            actionId: '',
            commandString: 'unknown',
            description: 'Unknown action.',
          },
          {
            index: 3,
            actionId: null,
            commandString: 'test',
            description: 'Test action.',
          },
          {
            index: 4,
            actionId: 'kissing:kiss',
            commandString: '',
            description: 'Kiss with no command.',
          },
          {
            index: 5,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: '',
          },
          {
            index: 6,
            actionId: 'anatomy:touch',
            commandString: 'touch',
            description: 'Touch gently.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Should handle gracefully and still produce output
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);

      // Should contain valid actions
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 6]');
    });
  });

  describe('Format Consistency', () => {
    it('should ensure descriptions end with punctuation', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait without punctuation',
          },
          {
            index: 2,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss with punctuation.',
          },
          {
            index: 3,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove clothing!',
          },
          {
            index: 4,
            actionId: 'anatomy:touch',
            commandString: 'touch',
            description: 'Touch gently?',
          },
          {
            index: 5,
            actionId: 'movement:go',
            commandString: 'go',
            description: '',
          }, // Empty description
          {
            index: 6,
            actionId: 'affection:hug',
            commandString: 'hug',
            description: 'Warm hug',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Extract all description lines
      const lines = result
        .split('\n')
        .filter((line) => line.includes('Description:'));

      for (const line of lines) {
        // Each description should end with punctuation
        expect(line).toMatch(/[.!?]$/);
      }
    });

    it('should maintain consistent command formatting', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
          },
          {
            index: 2,
            actionId: 'kissing:kiss',
            commandString: 'kiss passionately',
            description: 'Kiss.',
          },
          {
            index: 3,
            actionId: 'clothing:remove',
            commandString: 'remove all clothing',
            description: 'Remove.',
          },
          {
            index: 4,
            actionId: 'anatomy:touch',
            commandString: 'gently touch',
            description: 'Touch.',
          },
          {
            index: 5,
            actionId: 'movement:go',
            commandString: 'go to bedroom',
            description: 'Go.',
          },
          {
            index: 6,
            actionId: 'affection:hug',
            commandString: 'hug tightly',
            description: 'Hug.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // All commands should be properly quoted
      expect(result).toContain('Command: "wait"');
      expect(result).toContain('Command: "kiss passionately"');
      expect(result).toContain('Command: "remove all clothing"');
      expect(result).toContain('Command: "gently touch"');
      expect(result).toContain('Command: "go to bedroom"');
      expect(result).toContain('Command: "hug tightly"');
    });
  });
});
