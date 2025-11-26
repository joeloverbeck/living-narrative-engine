/**
 * @file AIPromptContentProvider Categorization Integration Tests
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';
import { PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE } from '../../src/constants/textDefaults.js';

describe('AIPromptContentProvider Categorization Integration', () => {
  let container;
  let promptContentProvider;
  let mockLogger;

  beforeEach(async () => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Register logger first (required by services)
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

    // Create provider with all dependencies
    promptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: jest.fn(() => 'Core task'),
        getCharacterPortrayalGuidelines: jest.fn(() => 'Guidelines'),
        getNc21ContentPolicyText: jest.fn(() => 'Policy'),
        getFinalLlmInstructionText: jest.fn(() => 'Instructions'),
      },
      perceptionLogFormatter: {
        format: jest.fn(() => 'Formatted log'),
      },
      gameStateValidationService: {
        validate: jest.fn(() => ({ isValid: true })),
      },
      actionCategorizationService: container.resolve(
        tokens.IActionCategorizationService
      ),
      characterDataXmlBuilder: {
        buildCharacterDataXml: jest.fn(() => '<character>Mock XML</character>'),
      },
      modActionMetadataProvider: {
        getMetadataForMod: jest.fn(() => null),
      },
    });
  });

  afterEach(() => {
    if (container && typeof container.reset === 'function') {
      container.reset();
    }
    container = null;
    jest.clearAllMocks();
  });

  describe('Categorized Output', () => {
    it('should format actions with categorization when thresholds met', () => {
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
            actionId: 'movement:go',
            commandString: 'go north',
            description: 'Move to the northern area.',
          },
          {
            index: 3,
            actionId: 'kissing:kiss',
            commandString: 'kiss Sarah',
            description: 'Kiss Sarah gently.',
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
            actionId: 'core:examine',
            commandString: 'examine room',
            description: 'Look around carefully.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toContain('## Available Actions');
      expect(result).toContain('### CORE Actions');
      expect(result).toContain('### KISSING Actions');
      expect(result).toContain('### CLOTHING Actions');

      // Verify action indexes are preserved
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 2]');
      expect(result).toContain('[Index: 3]');
      expect(result).toContain('[Index: 4]');
      expect(result).toContain('[Index: 5]');
      expect(result).toContain('[Index: 6]');

      // Verify action details are preserved
      expect(result).toContain('Command: "wait"');
      expect(result).toContain('Command: "kiss Sarah"');
      expect(result).toContain('Description: Wait for a moment.');
    });

    it('should maintain namespace priority order', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove clothing.',
          },
          {
            index: 2,
            actionId: 'anatomy:touch',
            commandString: 'touch',
            description: 'Touch something.',
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
            description: 'Kiss passionately.',
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

      // Check that order follows priority: core, affection, kissing, caressing, sex, anatomy, clothing, then alphabetical
      const coreIndex = result.indexOf('### CORE Actions');
      const kissingIndex = result.indexOf('### KISSING Actions');
      const sexIndex = result.indexOf('### SEX Actions');
      const anatomyIndex = result.indexOf('### ANATOMY Actions');
      const clothingIndex = result.indexOf('### CLOTHING Actions');

      expect(coreIndex).toBeLessThan(kissingIndex);
      expect(kissingIndex).toBeLessThan(sexIndex);
      expect(sexIndex).toBeLessThan(anatomyIndex);
      expect(anatomyIndex).toBeLessThan(clothingIndex);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to flat formatting when insufficient actions', () => {
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
          {
            index: 3,
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Move around.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).not.toContain('## Available Actions');
      expect(result).not.toContain('### CORE Actions');
      expect(result).toContain(
        'Choose one of the following available actions by its index'
      );
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 2]');
      expect(result).toContain('[Index: 3]');
    });

    it('should fall back to flat formatting when insufficient namespaces', () => {
      // Use only 1 namespace (all "core" actions) to test insufficient namespaces
      // The threshold is 2 namespaces, so having only 1 should trigger fallback
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
            actionId: 'core:go',
            commandString: 'go',
            description: 'Go.',
          },
          {
            index: 3,
            actionId: 'core:examine',
            commandString: 'examine',
            description: 'Examine.',
          },
          {
            index: 4,
            actionId: 'core:speak',
            commandString: 'speak',
            description: 'Speak.',
          },
          {
            index: 5,
            actionId: 'core:follow',
            commandString: 'follow',
            description: 'Follow.',
          },
          {
            index: 6,
            actionId: 'core:rest',
            commandString: 'rest',
            description: 'Rest.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).not.toContain('## Available Actions');
      expect(result).toContain(
        'Choose one of the following available actions by its index'
      );
    });

    it('should handle empty actions array', () => {
      const gameState = { availableActions: [] };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toBe(PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE);
    });

    it('should handle missing availableActions property', () => {
      const gameState = {};

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toBe(PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', () => {
      // Mock the service to throw an error
      const faultyService = {
        shouldUseGrouping: jest.fn(() => {
          throw new Error('Service error');
        }),
        groupActionsByNamespace: jest.fn(),
        formatNamespaceDisplayName: jest.fn(),
        extractNamespace: jest.fn(),
        getSortedNamespaces: jest.fn(),
      };

      const faultyProvider = new AIPromptContentProvider({
        logger: mockLogger,
        promptStaticContentService: {
          getCoreTaskDescriptionText: jest.fn(() => 'Core task'),
          getCharacterPortrayalGuidelines: jest.fn(() => 'Guidelines'),
          getNc21ContentPolicyText: jest.fn(() => 'Policy'),
          getFinalLlmInstructionText: jest.fn(() => 'Instructions'),
        },
        perceptionLogFormatter: { format: jest.fn(() => 'Log') },
        gameStateValidationService: {
          validate: jest.fn(() => ({ isValid: true })),
        },
        actionCategorizationService: faultyService,
        characterDataXmlBuilder: {
          buildCharacterDataXml: jest.fn(() => '<character>Mock XML</character>'),
        },
        modActionMetadataProvider: {
          getMetadataForMod: jest.fn(() => null),
        },
      });

      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
          },
        ],
      };

      const result = faultyProvider.getAvailableActionsInfoContent(gameState);

      // Should fall back gracefully and still format actions
      expect(result).toContain('[Index: 1]');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Critical error in action formatting'),
        expect.any(Object)
      );
    });

    it('should handle malformed action data', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
          },
          { index: 2 }, // Missing actionId
          null, // Null action
          { index: 3, actionId: 'kissing:kiss' }, // Missing other fields
          {
            index: 4,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove.',
          },
          {
            index: 5,
            actionId: 'anatomy:touch',
            commandString: 'touch',
            description: 'Touch.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Should handle gracefully - either categorized or flat format
      expect(result).toContain('[Index: 1]');
      expect(result).toContain('[Index: 4]');
      expect(result).toContain('[Index: 5]');

      // Should not crash
      expect(result).toBeTruthy();
    });
  });

  describe('Markdown Quality', () => {
    it('should produce valid markdown structure', () => {
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
            description: 'Kiss tenderly.',
          },
          {
            index: 3,
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Move around.',
          },
          {
            index: 4,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove clothing.',
          },
          {
            index: 5,
            actionId: 'affection:hug',
            commandString: 'hug',
            description: 'Give a warm hug.',
          },
          {
            index: 6,
            actionId: 'core:examine',
            commandString: 'examine',
            description: 'Look around.',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // Check markdown structure
      expect(result).toMatch(/^## Available Actions\s*$/m);
      expect(result).toMatch(/^### [A-Z]+ Actions \(\d+ actions?\)$/m);

      // Check action format exists in the result
      expect(result).toContain(
        '[Index: 1] Command: "wait". Description: Wait for a moment.'
      );
      expect(result).toContain(
        '[Index: 2] Command: "kiss". Description: Kiss tenderly.'
      );
      expect(result).toContain(
        '[Index: 4] Command: "remove". Description: Remove clothing.'
      );

      // Should not have trailing/leading whitespace
      expect(result).not.toMatch(/^\s+/);
      expect(result).not.toMatch(/\s+$/);
    });

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
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Move around!',
          },
          {
            index: 4,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove clothing?',
          },
          {
            index: 5,
            actionId: 'affection:hug',
            commandString: 'hug',
            description: '',
          },
          {
            index: 6,
            actionId: 'core:examine',
            commandString: 'examine',
            description: 'Look around carefully',
          },
        ],
      };

      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      // All descriptions should end with punctuation
      const lines = result
        .split('\n')
        .filter((line) => line.includes('[Index:'));
      for (const line of lines) {
        if (line.includes('Description:')) {
          expect(line).toMatch(/[.!?]$/);
        }
      }
    });
  });
});
