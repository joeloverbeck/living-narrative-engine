# ACTCAT-008: End-to-End Integration Testing

## Overview

Create comprehensive end-to-end integration tests that validate the complete action categorization workflow from game state input through categorized output in both UI and LLM contexts. This ensures all components work together correctly across the entire system.

## Priority

**HIGH** - Critical validation of complete system integration

## Dependencies

- **Blocks**: ACTCAT-005 (LLM prompt enhancement)
- **Blocks**: ACTCAT-009 (UI renderer refactoring)
- **Enables**: ACTCAT-010 (Regression testing)

## Acceptance Criteria

- [ ] End-to-end workflow tests for both UI and LLM paths
- [ ] Integration tests with real game state data
- [ ] Cross-component communication validation
- [ ] Error propagation and recovery testing
- [ ] Performance validation under realistic conditions
- [ ] Configuration consistency across components
- [ ] Service lifecycle and dependency management
- [ ] Real-world scenario coverage

## Implementation Steps

### Step 1: Complete Workflow Integration Tests

**File**: `tests/integration/actionCategorization/completeWorkflow.test.js`

```javascript
/**
 * @file Complete Action Categorization Workflow Integration Tests
 * Tests the entire flow from game state to categorized output
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';
import AIPromptContentProvider from '../../../src/prompting/AIPromptContentProvider.js';
import ActionButtonsRenderer from '../../../src/domUI/actionButtonsRenderer.js';

describe('Complete Action Categorization Workflow Integration', () => {
  let container;
  let promptProvider;
  let uiRenderer;
  let dom;
  let document;

  beforeEach(() => {
    // Set up JSDOM environment for UI testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="actions-container"></div>
          <button id="send-button">Send</button>
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    // Create container with all services
    container = createTestContainerWithActionCategorization();

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
      actionCategorizationService: container.resolve(
        'IActionCategorizationService'
      ),
    });

    // Create UI renderer
    uiRenderer = new ActionButtonsRenderer({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      documentContext: document,
      validatedEventDispatcher: { dispatch: jest.fn(), subscribe: jest.fn() },
      domElementFactory: {
        createElement: (tag) => document.createElement(tag),
        createButton: (text) => {
          const btn = document.createElement('button');
          btn.textContent = text;
          return btn;
        },
      },
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: container.resolve(
        'IActionCategorizationService'
      ),
    });
  });

  afterEach(() => {
    dom.window.close();
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Categorized Workflow - Sufficient Actions', () => {
    it('should categorize actions consistently across UI and LLM', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait for a moment, doing nothing.',
          },
          {
            index: 2,
            actionId: 'core:go',
            commandString: 'go north',
            description: 'Move to the northern area.',
          },
          {
            index: 3,
            actionId: 'intimacy:kiss_back_passionately',
            commandString: 'kiss Sarah passionately',
            description: 'Return the kiss with equal passion.',
          },
          {
            index: 4,
            actionId: 'intimacy:massage_shoulders',
            commandString: "massage Sarah's shoulders",
            description: 'Provide comfort through gentle touch.',
          },
          {
            index: 5,
            actionId: 'clothing:remove_clothing',
            commandString: 'remove shirt',
            description: 'Remove your shirt.',
          },
          {
            index: 6,
            actionId: 'core:examine',
            commandString: 'examine room',
            description: 'Look around the room carefully.',
          },
        ],
      };

      // Test LLM prompt generation
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);

      // Verify categorized structure
      expect(llmOutput).toContain('## Available Actions');
      expect(llmOutput).toContain('### CORE Actions');
      expect(llmOutput).toContain('### INTIMACY Actions');
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

      // Test UI rendering
      uiRenderer.renderActions(gameState.availableActions);

      const actionsContainer = document.getElementById('actions-container');
      expect(actionsContainer).toBeTruthy();

      // Verify UI grouped structure
      const namespaceGroups =
        actionsContainer.querySelectorAll('[data-namespace]');
      expect(namespaceGroups.length).toBeGreaterThan(1);

      const namespaces = Array.from(namespaceGroups).map((group) =>
        group.getAttribute('data-namespace')
      );
      expect(namespaces).toContain('core');
      expect(namespaces).toContain('intimacy');
      expect(namespaces).toContain('clothing');

      // Verify actions are in correct groups
      const coreGroup = actionsContainer.querySelector(
        '[data-namespace="core"]'
      );
      const coreActions = coreGroup.querySelectorAll('[data-action-index]');
      expect(coreActions.length).toBe(3); // wait, go, examine

      const intimacyGroup = actionsContainer.querySelector(
        '[data-namespace="intimacy"]'
      );
      const intimacyActions = intimacyGroup.querySelectorAll(
        '[data-action-index]'
      );
      expect(intimacyActions.length).toBe(2); // kiss, massage
    });

    it('should maintain consistent namespace ordering across components', () => {
      const gameState = {
        availableActions: [
          {
            index: 1,
            actionId: 'clothing:wear_dress',
            commandString: 'wear dress',
            description: 'Put on the dress.',
          },
          {
            index: 2,
            actionId: 'anatomy:examine_self',
            commandString: 'examine yourself',
            description: 'Look at your body.',
          },
          {
            index: 3,
            actionId: 'core:wait',
            commandString: 'wait',
            description: 'Wait patiently.',
          },
          {
            index: 4,
            actionId: 'intimacy:hold_hands',
            commandString: 'hold hands',
            description: 'Take their hand gently.',
          },
          {
            index: 5,
            actionId: 'sex:suggest_intimacy',
            commandString: 'suggest intimacy',
            description: 'Suggest being intimate.',
          },
          {
            index: 6,
            actionId: 'unknown_namespace:mystery',
            commandString: 'mystery action',
            description: 'A mysterious action.',
          },
        ],
      };

      // Check LLM ordering
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);

      const coreIndex = llmOutput.indexOf('### CORE Actions');
      const intimacyIndex = llmOutput.indexOf('### INTIMACY Actions');
      const sexIndex = llmOutput.indexOf('### SEX Actions');
      const anatomyIndex = llmOutput.indexOf('### ANATOMY Actions');
      const clothingIndex = llmOutput.indexOf('### CLOTHING Actions');
      const unknownIndex = llmOutput.indexOf('### UNKNOWN_NAMESPACE Actions');

      // Verify priority order: core, intimacy, sex, anatomy, clothing, then alphabetical
      expect(coreIndex).toBeLessThan(intimacyIndex);
      expect(intimacyIndex).toBeLessThan(sexIndex);
      expect(sexIndex).toBeLessThan(anatomyIndex);
      expect(anatomyIndex).toBeLessThan(clothingIndex);
      expect(clothingIndex).toBeLessThan(unknownIndex);

      // Check UI ordering
      uiRenderer.renderActions(gameState.availableActions);

      const namespaceGroups = document.querySelectorAll('[data-namespace]');
      const uiNamespaces = Array.from(namespaceGroups).map((group) =>
        group.getAttribute('data-namespace')
      );

      expect(uiNamespaces).toEqual([
        'core',
        'intimacy',
        'sex',
        'anatomy',
        'clothing',
        'unknown_namespace',
      ]);
    });
  });

  describe('Flat Workflow - Insufficient Actions', () => {
    it('should handle insufficient actions consistently across components', () => {
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
            actionId: 'intimacy:kiss',
            commandString: 'kiss',
            description: 'Kiss gently.',
          },
          {
            index: 3,
            actionId: 'core:go',
            commandString: 'go',
            description: 'Move around.',
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

      // Test UI - should use flat format
      uiRenderer.renderActions(gameState.availableActions);

      const actionsContainer = document.getElementById('actions-container');
      const namespaceGroups =
        actionsContainer.querySelectorAll('[data-namespace]');

      // Should not have namespace groups for insufficient actions
      expect(namespaceGroups.length).toBe(0);

      // Should have direct action buttons
      const actionButtons = actionsContainer.querySelectorAll(
        '[data-action-index]'
      );
      expect(actionButtons.length).toBe(3);
    });

    it('should handle insufficient namespaces consistently', () => {
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

      // Both should use flat format due to only one namespace
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(gameState);
      expect(llmOutput).toContain(
        'Choose one of the following available actions by its index'
      );
      expect(llmOutput).not.toContain('### CORE Actions');

      uiRenderer.renderActions(gameState.availableActions);
      const namespaceGroups = document.querySelectorAll('[data-namespace]');
      expect(namespaceGroups.length).toBe(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully across components', () => {
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

      // Create providers with faulty service
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

      const faultyUIRenderer = new ActionButtonsRenderer({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        documentContext: document,
        validatedEventDispatcher: { dispatch: jest.fn(), subscribe: jest.fn() },
        domElementFactory: {
          createElement: (tag) => document.createElement(tag),
          createButton: (text) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            return btn;
          },
        },
        actionButtonsContainerSelector: '#actions-container',
        actionCategorizationService: faultyService,
      });

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
            actionId: 'intimacy:kiss',
            commandString: 'kiss',
            description: 'Kiss.',
          },
        ],
      };

      // Both should fallback gracefully
      expect(() => {
        const llmOutput =
          faultyPromptProvider.getAvailableActionsInfoContent(gameState);
        expect(llmOutput).toBeTruthy();
        expect(llmOutput).toContain('[Index: 1]');
      }).not.toThrow();

      expect(() => {
        faultyUIRenderer.renderActions(gameState.availableActions);
        const actionButtons = document.querySelectorAll('[data-action-index]');
        expect(actionButtons.length).toBeGreaterThan(0);
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
          },
          null, // Null action
          { index: 2 }, // Missing fields
          { index: 3, actionId: '', commandString: '', description: '' }, // Empty fields
          {
            index: 4,
            actionId: 'intimacy:kiss',
            commandString: 'kiss',
            description: 'Kiss.',
          },
        ],
      };

      // LLM should handle gracefully
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(malformedGameState);
      expect(llmOutput).toBeTruthy();
      expect(llmOutput).toContain('[Index: 1]');
      expect(llmOutput).toContain('[Index: 4]');

      // UI should handle gracefully
      expect(() => {
        uiRenderer.renderActions(malformedGameState.availableActions);
      }).not.toThrow();

      const actionButtons = document.querySelectorAll('[data-action-index]');
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect shared configuration across components', () => {
      const configLoader = container.resolve(
        'IActionCategorizationConfigLoader'
      );

      // Load different configurations
      const uiConfig = configLoader.loadConfiguration('ui');
      const llmConfig = configLoader.loadConfiguration('llm');

      // Verify core settings are consistent
      expect(uiConfig.enabled).toBe(llmConfig.enabled);
      expect(uiConfig.minActionsForGrouping).toBe(
        llmConfig.minActionsForGrouping
      );
      expect(uiConfig.minNamespacesForGrouping).toBe(
        llmConfig.minNamespacesForGrouping
      );
      expect(uiConfig.namespaceOrder).toEqual(llmConfig.namespaceOrder);

      // Verify UI-specific differences
      expect(uiConfig.showCounts).toBe(true);
      expect(llmConfig.showCounts).toBe(false);
    });

    it('should handle configuration changes dynamically', () => {
      const configLoader = container.resolve(
        'IActionCategorizationConfigLoader'
      );

      // Test with custom configuration
      const customConfig = {
        enabled: true,
        minActionsForGrouping: 4,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['test', 'core'],
        showCounts: false,
      };

      const testConfig = configLoader.loadConfiguration('runtime', {
        config: customConfig,
      });

      expect(testConfig.minActionsForGrouping).toBe(4);
      expect(testConfig.namespaceOrder).toEqual(['test', 'core']);
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance under realistic load', () => {
      const largeGameState = {
        availableActions: Array.from({ length: 50 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 12}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action number ${i} with some detail.`,
        })),
      };

      // Test LLM performance
      const llmStartTime = performance.now();
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(largeGameState);
      const llmEndTime = performance.now();

      expect(llmEndTime - llmStartTime).toBeLessThan(50); // 50ms threshold
      expect(llmOutput).toBeTruthy();

      // Test UI performance
      const uiStartTime = performance.now();
      uiRenderer.renderActions(largeGameState.availableActions);
      const uiEndTime = performance.now();

      expect(uiEndTime - uiStartTime).toBeLessThan(100); // 100ms threshold

      const actionButtons = document.querySelectorAll('[data-action-index]');
      expect(actionButtons.length).toBe(50);
    });

    it('should handle concurrent operations efficiently', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 6}:action${i}`,
          commandString: `command ${i}`,
          description: `Description ${i}.`,
        })),
      };

      const operations = [];

      // Simulate concurrent LLM and UI operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          Promise.resolve(
            promptProvider.getAvailableActionsInfoContent(gameState)
          ),
          Promise.resolve(uiRenderer.renderActions(gameState.availableActions))
        );
      }

      return Promise.all(operations).then((results) => {
        expect(results.length).toBe(20);

        // All LLM results should be valid
        const llmResults = results.filter((_, index) => index % 2 === 0);
        llmResults.forEach((result) => {
          expect(result).toBeTruthy();
          expect(result).toContain('Actions');
        });
      });
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
            },
            {
              index: 2,
              actionId: 'core:examine',
              commandString: 'examine room',
              description: 'Look around.',
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
            },
            {
              index: 2,
              actionId: 'core:go',
              commandString: 'go north',
              description: 'Head north.',
            },
            {
              index: 3,
              actionId: 'intimacy:talk',
              commandString: 'talk to Sarah',
              description: 'Have a conversation.',
            },
            {
              index: 4,
              actionId: 'intimacy:compliment',
              commandString: 'compliment Sarah',
              description: 'Say something nice.',
            },
            {
              index: 5,
              actionId: 'core:examine',
              commandString: 'examine surroundings',
              description: 'Look around carefully.',
            },
            {
              index: 6,
              actionId: 'clothing:adjust',
              commandString: 'adjust clothing',
              description: 'Straighten your clothes.',
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
            },
            {
              index: 2,
              actionId: 'core:go',
              commandString: 'go to bedroom',
              description: 'Move to the bedroom.',
            },
            {
              index: 3,
              actionId: 'intimacy:kiss',
              commandString: 'kiss passionately',
              description: 'Kiss with deep feeling.',
            },
            {
              index: 4,
              actionId: 'intimacy:embrace',
              commandString: 'hold close',
              description: 'Pull them close.',
            },
            {
              index: 5,
              actionId: 'clothing:remove',
              commandString: 'remove shirt',
              description: 'Take off your shirt.',
            },
            {
              index: 6,
              actionId: 'clothing:help_remove',
              commandString: 'help with clothing',
              description: 'Help them undress.',
            },
            {
              index: 7,
              actionId: 'anatomy:caress',
              commandString: 'caress gently',
              description: 'Touch tenderly.',
            },
            {
              index: 8,
              actionId: 'sex:suggest',
              commandString: 'suggest intimacy',
              description: 'Suggest being together.',
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

        // Test UI rendering
        expect(() => {
          uiRenderer.renderActions(scenario.actions);
        }).not.toThrow();

        const actionButtons = document.querySelectorAll('[data-action-index]');
        expect(actionButtons.length).toBe(scenario.actions.length);

        // Clear for next scenario
        document.getElementById('actions-container').innerHTML = '';
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
            },
            {
              index: 2,
              actionId: '',
              commandString: 'empty id',
              description: 'Empty action ID.',
            },
            {
              index: 3,
              actionId: 'malformed',
              commandString: 'no namespace',
              description: 'No namespace separator.',
            },
            {
              index: 4,
              actionId: 'intimacy:valid',
              commandString: 'valid intimacy',
              description: 'Valid intimacy action.',
            },
            {
              index: 5,
              actionId: 'clothing:valid',
              commandString: 'valid clothing',
              description: 'Valid clothing action.',
            },
            {
              index: 6,
              actionId: 'core:another',
              commandString: 'another valid',
              description: 'Another valid action.',
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
            },
            {
              index: 2,
              actionId: 'intimacy:kiss',
              commandString: 'kiss 💋',
              description: 'Kiss with love 💕.',
            },
            {
              index: 3,
              actionId: 'clothing:wear',
              commandString: 'wear café outfit',
              description: 'Put on café uniform.',
            },
            {
              index: 4,
              actionId: 'anatomy:touch',
              commandString: 'touch gently',
              description: 'Touch with care.',
            },
            {
              index: 5,
              actionId: 'core:examine',
              commandString: 'examine "special" item',
              description: 'Look at the "special" item.',
            },
            {
              index: 6,
              actionId: 'intimacy:whisper',
              commandString: 'whisper sweetly',
              description: 'Whisper "I love you".',
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

        expect(() => {
          uiRenderer.renderActions(scenario.actions);
        }).not.toThrow();
      });
    });
  });
});
```

### Step 2: Cross-Component Integration Tests

**File**: `tests/integration/actionCategorization/crossComponentIntegration.test.js`

```javascript
/**
 * @file Cross-Component Integration Tests
 * Tests integration between different system components
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('Cross-Component Integration', () => {
  let container;
  let categorizationService;
  let configLoader;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();
    categorizationService = container.resolve('IActionCategorizationService');
    configLoader = container.resolve('IActionCategorizationConfigLoader');
  });

  describe('Service and Configuration Integration', () => {
    it('should use configuration consistently across service calls', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 3,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove.',
        },
        {
          index: 4,
          actionId: 'anatomy:touch',
          commandString: 'touch',
          description: 'Touch.',
        },
        {
          index: 5,
          actionId: 'sex:initiate',
          commandString: 'initiate',
          description: 'Initiate.',
        },
        {
          index: 6,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go.',
        },
      ];

      const uiConfig = configLoader.loadConfiguration('ui');
      const llmConfig = configLoader.loadConfiguration('llm');

      // Both configurations should make same grouping decision
      const uiShouldGroup = categorizationService.shouldUseGrouping(
        actions,
        uiConfig
      );
      const llmShouldGroup = categorizationService.shouldUseGrouping(
        actions,
        llmConfig
      );

      expect(uiShouldGroup).toBe(llmShouldGroup);
      expect(uiShouldGroup).toBe(true);

      // Both should produce same grouping structure
      const uiGrouped = categorizationService.groupActionsByNamespace(
        actions,
        uiConfig
      );
      const llmGrouped = categorizationService.groupActionsByNamespace(
        actions,
        llmConfig
      );

      expect(uiGrouped.size).toBe(llmGrouped.size);
      expect([...uiGrouped.keys()]).toEqual([...llmGrouped.keys()]);
    });

    it('should handle configuration changes dynamically', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 3,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go.',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug.',
        },
      ];

      // Default config - should not group (insufficient actions)
      const defaultConfig = configLoader.loadConfiguration('default');
      expect(
        categorizationService.shouldUseGrouping(actions, defaultConfig)
      ).toBe(false);

      // Custom config with lower thresholds - should group
      const customConfig = configLoader.loadConfiguration('runtime', {
        config: {
          enabled: true,
          minActionsForGrouping: 3,
          minNamespacesForGrouping: 2,
          namespaceOrder: ['core', 'intimacy'],
          showCounts: false,
        },
      });

      expect(
        categorizationService.shouldUseGrouping(actions, customConfig)
      ).toBe(true);
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should isolate errors between components', () => {
      // Test that an error in one component doesn't affect others
      const faultyService = {
        shouldUseGrouping: jest.fn(() => {
          throw new Error('Service error');
        }),
        groupActionsByNamespace: jest.fn(() => new Map()),
        extractNamespace: jest.fn((id) =>
          id.includes(':') ? id.split(':')[0] : 'unknown'
        ),
        getSortedNamespaces: jest.fn((namespaces) => [...namespaces].sort()),
        formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
      };

      // Replace service in container
      container.register({
        token: 'IActionCategorizationService',
        factory: () => faultyService,
        lifetime: 'singleton',
      });

      // Config loader should still work
      expect(() => {
        const config = configLoader.loadConfiguration('default');
        expect(config).toBeTruthy();
      }).not.toThrow();

      // Other service methods should still work
      expect(faultyService.extractNamespace('core:wait')).toBe('core');
      expect(faultyService.formatNamespaceDisplayName('core')).toBe('CORE');
    });

    it('should provide graceful degradation paths', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
      ];

      // Service with partial failures
      const partiallyFaultyService = {
        shouldUseGrouping: jest.fn(() => false), // Works but returns false
        groupActionsByNamespace: jest.fn(() => {
          throw new Error('Grouping error');
        }),
        extractNamespace: jest.fn((id) =>
          id.includes(':') ? id.split(':')[0] : 'unknown'
        ),
        getSortedNamespaces: jest.fn(() => {
          throw new Error('Sorting error');
        }),
        formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
      };

      // System should gracefully handle partial functionality
      expect(partiallyFaultyService.shouldUseGrouping(actions)).toBe(false);
      expect(partiallyFaultyService.extractNamespace('core:wait')).toBe('core');
      expect(partiallyFaultyService.formatNamespaceDisplayName('core')).toBe(
        'CORE'
      );

      // Failing methods should throw but not crash the system
      expect(() =>
        partiallyFaultyService.groupActionsByNamespace(actions)
      ).toThrow();
      expect(() =>
        partiallyFaultyService.getSortedNamespaces(['core'])
      ).toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle container disposal gracefully', () => {
      // Resolve services
      const service = container.resolve('IActionCategorizationService');
      const loader = container.resolve('IActionCategorizationConfigLoader');

      expect(service).toBeTruthy();
      expect(loader).toBeTruthy();

      // Container disposal should work without errors
      if (container.dispose) {
        expect(() => container.dispose()).not.toThrow();
      }
    });

    it('should maintain singleton behavior', () => {
      const service1 = container.resolve('IActionCategorizationService');
      const service2 = container.resolve('IActionCategorizationService');
      const loader1 = container.resolve('IActionCategorizationConfigLoader');
      const loader2 = container.resolve('IActionCategorizationConfigLoader');

      expect(service1).toBe(service2);
      expect(loader1).toBe(loader2);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated operations', () => {
      const actions = Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 5}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = configLoader.loadConfiguration('default');

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        categorizationService.shouldUseGrouping(actions, config);
        if (i % 2 === 0) {
          categorizationService.groupActionsByNamespace(actions, config);
        }
        categorizationService.extractNamespace(
          actions[i % actions.length].actionId
        );
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // <2MB
    });

    it('should handle concurrent access safely', () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        actionId: `test:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = configLoader.loadConfiguration('default');

      // Create multiple promises for concurrent access
      const promises = Array.from({ length: 50 }, (_, i) => {
        return Promise.resolve().then(() => {
          const shouldGroup = categorizationService.shouldUseGrouping(
            actions,
            config
          );
          if (shouldGroup) {
            return categorizationService.groupActionsByNamespace(
              actions,
              config
            );
          }
          return new Map();
        });
      });

      return Promise.all(promises).then((results) => {
        expect(results.length).toBe(50);
        // All results should be consistent
        const firstResult = results[0];
        results.forEach((result) => {
          if (firstResult instanceof Map) {
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(firstResult.size);
          }
        });
      });
    });
  });
});
```

## Quality Gates

### Integration Validation

- [ ] Complete workflow tests for both UI and LLM paths
- [ ] Cross-component communication validated
- [ ] Error propagation and recovery tested
- [ ] Configuration consistency verified
- [ ] Service lifecycle management confirmed

### Real-World Scenario Coverage

- [ ] Typical game progression scenarios
- [ ] Edge cases from actual game data
- [ ] Performance under realistic load
- [ ] Concurrent operation handling
- [ ] Memory management validation

### Error Handling

- [ ] Graceful degradation paths
- [ ] Component isolation during failures
- [ ] Recovery mechanisms tested
- [ ] Fallback behavior validation

## Performance Targets

- [ ] End-to-end workflow: <100ms for typical scenarios
- [ ] Concurrent operations: No performance degradation
- [ ] Memory usage: <2MB increase during stress testing
- [ ] Error recovery: <10ms fallback time

## Files Created

- [ ] `tests/integration/actionCategorization/completeWorkflow.test.js`
- [ ] `tests/integration/actionCategorization/crossComponentIntegration.test.js`

## Files Modified

- None (pure addition of integration tests)

## Dependencies

- **Completes**: ACTCAT-005, ACTCAT-009
- **Enables**: ACTCAT-010

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Complete workflow tests pass
- [ ] Cross-component integration validated
- [ ] Error handling and recovery tested
- [ ] Performance targets achieved
- [ ] Real-world scenarios covered
- [ ] Memory management confirmed
- [ ] Code review approved
