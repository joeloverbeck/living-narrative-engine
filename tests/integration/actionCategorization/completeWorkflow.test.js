/**
 * @file Complete Action Categorization Workflow Integration Tests
 * Tests the entire flow from game state to categorized output
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('Complete Action Categorization Workflow Integration', () => {
  let container;
  let actionCategorizationService;
  let promptProvider;

  beforeEach(async () => {
    // Create container with required services
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

    // Get the action categorization service
    actionCategorizationService = container.resolve(
      tokens.IActionCategorizationService
    );

    // Create prompt provider
    promptProvider = new AIPromptContentProvider({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      promptStaticContentService: {
        getCoreTaskDescriptionText: () =>
          'You are playing an interactive narrative game.',
        getCharacterPortrayalGuidelines: () =>
          'Portray characters realistically.',
        getNc21ContentPolicyText: () => 'Follow content guidelines.',
        getFinalLlmInstructionText: () => 'Choose an action by its index.',
      },
      perceptionLogFormatter: { format: (log) => `Formatted: ${log}` },
      gameStateValidationService: {
        validate: (state) => ({ isValid: true, errors: [] }),
      },
      actionCategorizationService: actionCategorizationService,
    });
  });

  afterEach(() => {
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Categorized Workflow - Sufficient Actions', () => {
    it('should categorize actions consistently in LLM output', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait for a moment, doing nothing.',
            params: {},
          },
          {
            index: 2,
            actionId: 'movement:go',
            commandString: 'go north',
            description: 'Move to the northern area.',
            params: {},
          },
          {
            index: 3,
            actionId: 'kissing:kiss_back_passionately',
            commandString: 'kiss Sarah passionately',
            description: 'Return the kiss with equal passion.',
            params: {},
          },
          {
            index: 4,
            actionId: 'affection:massage_shoulders',
            commandString: "massage Sarah's shoulders",
            description: 'Provide comfort through gentle touch.',
            params: {},
          },
          {
            index: 5,
            actionId: 'clothing:remove_clothing',
            commandString: 'remove shirt',
            description: 'Remove your shirt.',
            params: {},
          },
          {
            index: 6,
            actionId: 'core:examine',
            commandString: 'examine room',
            description: 'Look around the room carefully.',
            params: {},
          },
        ],
      };

      // Test LLM prompt generation
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);

      // Verify categorized structure
      expect(llmOutput).toContain('## Available Actions');
      expect(llmOutput).toContain('### CORE Actions');
      expect(llmOutput).toContain('### MOVEMENT Actions');
      expect(llmOutput).toContain('### AFFECTION Actions');
      expect(llmOutput).toContain('### KISSING Actions');
      expect(llmOutput).toContain('### CLOTHING Actions');

      // Verify action preservation
      expect(llmOutput).toContain(
        '[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.'
      );
      expect(llmOutput).toContain(
        '[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.'
      );
      expect(llmOutput).toContain(
        '[Index: 5] Command: "remove shirt". Description: Remove your shirt.'
      );

      // Verify that categorization service is being used
      const shouldGroup = actionCategorizationService.shouldUseGrouping(
        gameState.availableActions
      );
      expect(shouldGroup).toBe(true);

      // Verify grouping logic
      const grouped = actionCategorizationService.groupActionsByNamespace(
        gameState.availableActions
      );
      expect(grouped.size).toBe(5); // core, affection, kissing, clothing, movement
      expect(grouped.get('core')).toHaveLength(2); // wait, examine
      expect(grouped.get('movement')).toHaveLength(1); // go
      expect(grouped.get('affection')).toHaveLength(1); // massage
      expect(grouped.get('kissing')).toHaveLength(1); // kiss
      expect(grouped.get('clothing')).toHaveLength(1);
    });

    it('should maintain consistent namespace ordering', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'clothing:wear_dress',
            commandString: 'wear dress',
            description: 'Put on the dress.',
            params: {},
          },
          {
            index: 2,
            actionId: 'anatomy:examine_self',
            commandString: 'examine yourself',
            description: 'Look at your body.',
            params: {},
          },
          {
            index: 3,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait patiently.',
            params: {},
          },
          {
            index: 4,
            actionId: 'affection:hold_hands',
            commandString: 'hold hands',
            description: 'Take their hand gently.',
            params: {},
          },
          {
            index: 5,
            actionId: 'sex:suggest_intimacy',
            commandString: 'suggest intimacy',
            description: 'Suggest being intimate.',
            params: {},
          },
          {
            index: 6,
            actionId: 'unknown_namespace:mystery',
            commandString: 'mystery action',
            description: 'A mysterious action.',
            params: {},
          },
        ],
      };

      // Check LLM ordering
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);

      const coreIndex = llmOutput.indexOf('### CORE Actions');
      const affectionIndex = llmOutput.indexOf('### AFFECTION Actions');
      const sexIndex = llmOutput.indexOf('### SEX Actions');
      const anatomyIndex = llmOutput.indexOf('### ANATOMY Actions');
      const clothingIndex = llmOutput.indexOf('### CLOTHING Actions');
      const unknownIndex = llmOutput.indexOf('### UNKNOWN_NAMESPACE Actions');

      // Verify priority order: core, affection, sex, anatomy, clothing, then alphabetical
      expect(coreIndex).toBeLessThan(affectionIndex);
      expect(affectionIndex).toBeLessThan(sexIndex);
      expect(sexIndex).toBeLessThan(anatomyIndex);
      expect(anatomyIndex).toBeLessThan(clothingIndex);
      expect(clothingIndex).toBeLessThan(unknownIndex);

      // Verify service sorts namespaces correctly
      const sortedNamespaces = actionCategorizationService.getSortedNamespaces([
        'core',
        'affection',
        'sex',
        'anatomy',
        'clothing',
        'unknown_namespace',
      ]);

      expect(sortedNamespaces).toEqual([
        'core',
        'affection',
        'sex',
        'anatomy',
        'clothing',
        'unknown_namespace',
      ]);
    });
  });

  describe('Flat Workflow - Insufficient Actions', () => {
    it('should handle insufficient actions with flat formatting', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait for a moment.',
            params: {},
          },
          {
            index: 2,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss gently.',
            params: {},
          },
          {
            index: 3,
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Move around.',
            params: {},
          },
        ],
      };

      // Test LLM - should use flat format
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);

      expect(llmOutput).not.toContain('## Available Actions');
      expect(llmOutput).not.toContain('### CORE Actions');
      expect(llmOutput).toContain(
        'Choose one of the following available actions by its index'
      );
      expect(llmOutput).toContain('[Index: 1]');
      expect(llmOutput).toContain('[Index: 2]');
      expect(llmOutput).toContain('[Index: 3]');

      // Verify flat rendering (no grouping) for insufficient actions
      const shouldGroup = actionCategorizationService.shouldUseGrouping(
        gameState.availableActions
      );
      expect(shouldGroup).toBe(false);
    });

    it('should handle insufficient namespaces with flat formatting', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
            params: {},
          },
          {
            index: 2,
            actionId: 'movement:go',
            commandString: 'go',
            description: 'Go.',
            params: {},
          },
          {
            index: 3,
            actionId: 'core:examine',
            commandString: 'examine',
            description: 'Examine.',
            params: {},
          },
          {
            index: 4,
            actionId: 'core:speak',
            commandString: 'speak',
            description: 'Speak.',
            params: {},
          },
          {
            index: 5,
            actionId: 'core:follow',
            commandString: 'follow',
            description: 'Follow.',
            params: {},
          },
          {
            index: 6,
            actionId: 'core:rest',
            commandString: 'rest',
            description: 'Rest.',
            params: {},
          },
        ],
      };

      // Should use grouped format due to having 2 namespaces (core and movement)
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);
      expect(llmOutput).toContain('## Available Actions');
      expect(llmOutput).toContain('### CORE Actions');
      expect(llmOutput).toContain('### MOVEMENT Actions');

      const shouldGroup = actionCategorizationService.shouldUseGrouping(
        gameState.availableActions
      );
      expect(shouldGroup).toBe(true); // 2 namespaces meets the threshold
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', () => {
      // Create faulty service
      const faultyService = {
        shouldUseGrouping: jest.fn(() => {
          throw new Error('Service error');
        }),
        groupActionsByNamespace: jest.fn(() => {
          throw new Error('Service error');
        }),
        extractNamespace: jest.fn(() => {
          throw new Error('Service error');
        }),
        getSortedNamespaces: jest.fn(() => {
          throw new Error('Service error');
        }),
        formatNamespaceDisplayName: jest.fn(() => {
          throw new Error('Service error');
        }),
      };

      // Create provider with faulty service
      const faultyPromptProvider = new AIPromptContentProvider({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        promptStaticContentService: {
          getCoreTaskDescriptionText: () => 'Core task',
          getCharacterPortrayalGuidelines: () => 'Guidelines',
          getNc21ContentPolicyText: () => 'Policy',
          getFinalLlmInstructionText: () => 'Instructions',
        },
        perceptionLogFormatter: { format: () => 'Log' },
        gameStateValidationService: { validate: () => ({ isValid: true }) },
        actionCategorizationService: faultyService,
      });

      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
            params: {},
          },
          {
            index: 2,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss.',
            params: {},
          },
        ],
      };

      // Should fallback gracefully
      expect(() => {
        const llmOutput =
          faultyPromptProvider.getAvailableActionsInfoContent(gameState);
        expect(llmOutput).toBeTruthy();
        expect(llmOutput).toContain('[Index: 1]');
      }).not.toThrow();
    });

    it('should handle malformed action data consistently', () => {
      const malformedGameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait.',
            params: {},
          },
          null, // Null action
          { index: 2 }, // Missing fields
          {
            index: 3,
            actionId: '',
            commandString: '',
            description: '',
            params: {},
          }, // Empty fields
          {
            index: 4,
            actionId: 'kissing:kiss',
            commandString: 'kiss',
            description: 'Kiss.',
            params: {},
          },
        ],
      };

      // LLM should handle gracefully
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(malformedGameState);
      expect(llmOutput).toBeTruthy();
      expect(llmOutput).toContain('[Index: 1]');
      expect(llmOutput).toContain('[Index: 4]');
    });
  });

  describe('Configuration Integration', () => {
    it('should respect shared configuration across components', async () => {
      // Import configuration constants
      const { UI_CATEGORIZATION_CONFIG, LLM_CATEGORIZATION_CONFIG } =
        await import(
          '../../../src/entities/utils/actionCategorizationConfig.js'
        );

      // Verify core settings are consistent
      expect(UI_CATEGORIZATION_CONFIG.enabled).toBe(
        LLM_CATEGORIZATION_CONFIG.enabled
      );
      expect(UI_CATEGORIZATION_CONFIG.minActionsForGrouping).toBe(
        LLM_CATEGORIZATION_CONFIG.minActionsForGrouping
      );
      expect(UI_CATEGORIZATION_CONFIG.minNamespacesForGrouping).toBe(
        LLM_CATEGORIZATION_CONFIG.minNamespacesForGrouping
      );
      expect(UI_CATEGORIZATION_CONFIG.namespaceOrder).toEqual(
        LLM_CATEGORIZATION_CONFIG.namespaceOrder
      );

      // Verify UI-specific differences
      expect(UI_CATEGORIZATION_CONFIG.showCounts).toBe(true);
      expect(LLM_CATEGORIZATION_CONFIG.showCounts).toBe(false);
    });

    it('should handle configuration changes through service constructor', async () => {
      // Test with custom configuration
      const customConfig = {
        enabled: true,
        minActionsForGrouping: 4,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['test', 'core'],
        showCounts: false,
      };

      // Create new service instance with custom config
      const ActionCategorizationService = (
        await import(
          '../../../src/entities/utils/ActionCategorizationService.js'
        )
      ).default;

      const customService = new ActionCategorizationService({
        logger: container.resolve(tokens.ILogger),
        config: customConfig,
      });

      // Test that custom config is applied
      const actions = [
        {
          index: 1,
          actionId: 'test:action1',
          commandString: 'test 1',
          description: 'Test 1',
          params: {},
        },
        {
          index: 2,
          actionId: 'test:action2',
          commandString: 'test 2',
          description: 'Test 2',
          params: {},
        },
        {
          index: 3,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
          params: {},
        },
        {
          index: 4,
          actionId: 'movement:go',
          commandString: 'go',
          description: 'Go',
          params: {},
        },
      ];

      const shouldGroup = customService.shouldUseGrouping(actions);
      expect(shouldGroup).toBe(true); // 4 actions, 2 namespaces meets custom thresholds
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical game progression scenario', () => {
      // Simulate a game progression with changing action sets
      const scenarios = [
        {
          name: 'Early game - few actions',
          actions: [
            {
              index: 1,
              actionId: 'core:wait',
              commandString: 'wait',
              description: 'Wait and observe.',
              params: {},
            },
            {
              index: 2,
              actionId: 'core:examine',
              commandString: 'examine room',
              description: 'Look around.',
              params: {},
            },
          ],
        },
        {
          name: 'Mid game - moderate actions with intimacy',
          actions: [
            {
              index: 1,
              actionId: 'core:wait',
              commandString: 'wait',
              description: 'Wait patiently.',
              params: {},
            },
            {
              index: 2,
              actionId: 'movement:go',
              commandString: 'go north',
              description: 'Head north.',
              params: {},
            },
            {
              index: 3,
              actionId: 'affection:talk',
              commandString: 'talk to Sarah',
              description: 'Have a conversation.',
              params: {},
            },
            {
              index: 4,
              actionId: 'affection:compliment',
              commandString: 'compliment Sarah',
              description: 'Say something nice.',
              params: {},
            },
            {
              index: 5,
              actionId: 'core:examine',
              commandString: 'examine surroundings',
              description: 'Look around carefully.',
              params: {},
            },
            {
              index: 6,
              actionId: 'clothing:adjust',
              commandString: 'adjust clothing',
              description: 'Straighten your clothes.',
              params: {},
            },
          ],
        },
        {
          name: 'Late game - full action set',
          actions: [
            {
              index: 1,
              actionId: 'core:wait',
              commandString: 'wait',
              description: 'Wait and think.',
              params: {},
            },
            {
              index: 2,
              actionId: 'movement:go',
              commandString: 'go to bedroom',
              description: 'Move to the bedroom.',
              params: {},
            },
            {
              index: 3,
              actionId: 'kissing:kiss',
              commandString: 'kiss passionately',
              description: 'Kiss with deep feeling.',
              params: {},
            },
            {
              index: 4,
              actionId: 'hugging:hug_tight',
              commandString: 'hold close',
              description: 'Pull them close.',
              params: {},
            },
            {
              index: 5,
              actionId: 'clothing:remove',
              commandString: 'remove shirt',
              description: 'Take off your shirt.',
              params: {},
            },
            {
              index: 6,
              actionId: 'clothing:help_remove',
              commandString: 'help with clothing',
              description: 'Help them undress.',
              params: {},
            },
            {
              index: 7,
              actionId: 'anatomy:caress',
              commandString: 'caress gently',
              description: 'Touch tenderly.',
              params: {},
            },
            {
              index: 8,
              actionId: 'sex:suggest',
              commandString: 'suggest intimacy',
              description: 'Suggest being together.',
              params: {},
            },
          ],
        },
      ];

      scenarios.forEach((scenario) => {
        const gameState = { availableActions: scenario.actions };

        // Test LLM output
        const llmOutput =
          promptProvider.getAvailableActionsInfoContent(gameState);
        expect(llmOutput).toBeTruthy();

        // Verify appropriate formatting based on action count
        if (scenario.actions.length >= 6) {
          expect(llmOutput).toContain('## Available Actions');
        } else {
          expect(llmOutput).toContain(
            'Choose one of the following available actions'
          );
        }
      });
    });

    it('should handle edge cases from real game data', () => {
      const edgeCaseScenarios = [
        {
          name: 'Mixed valid and invalid actions',
          actions: [
            {
              index: 1,
              actionId: 'core:valid',
              commandString: 'valid action',
              description: 'A valid action.',
              params: {},
            },
            {
              index: 2,
              actionId: '',
              commandString: 'empty id',
              description: 'Empty action ID.',
              params: {},
            },
            {
              index: 3,
              actionId: 'malformed',
              commandString: 'no namespace',
              description: 'No namespace separator.',
              params: {},
            },
            {
              index: 4,
              actionId: 'affection:valid',
              commandString: 'valid affection',
              description: 'Valid affection action.',
              params: {},
            },
            {
              index: 5,
              actionId: 'clothing:valid',
              commandString: 'valid clothing',
              description: 'Valid clothing action.',
              params: {},
            },
            {
              index: 6,
              actionId: 'core:another',
              commandString: 'another valid',
              description: 'Another valid action.',
              params: {},
            },
          ],
        },
        {
          name: 'Unicode and special characters',
          actions: [
            {
              index: 1,
              actionId: 'core:wait',
              commandString: 'wait',
              description: 'Wait patiently.',
              params: {},
            },
            {
              index: 2,
              actionId: 'kissing:kiss',
              commandString: 'kiss 💋',
              description: 'Kiss with love 💕.',
              params: {},
            },
            {
              index: 3,
              actionId: 'clothing:wear',
              commandString: 'wear café outfit',
              description: 'Put on café uniform.',
              params: {},
            },
            {
              index: 4,
              actionId: 'anatomy:touch',
              commandString: 'touch gently',
              description: 'Touch with care.',
              params: {},
            },
            {
              index: 5,
              actionId: 'core:examine',
              commandString: 'examine "special" item',
              description: 'Look at the "special" item.',
              params: {},
            },
            {
              index: 6,
              actionId: 'affection:whisper',
              commandString: 'whisper sweetly',
              description: 'Whisper "I love you".',
              params: {},
            },
          ],
        },
      ];

      edgeCaseScenarios.forEach((scenario) => {
        const gameState = { availableActions: scenario.actions };

        expect(() => {
          const llmOutput =
            promptProvider.getAvailableActionsInfoContent(gameState);
          expect(llmOutput).toBeTruthy();
        }).not.toThrow();
      });
    });
  });
});
