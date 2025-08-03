# ACTCAT-010: Comprehensive Regression Testing

## Overview

Execute comprehensive regression testing to ensure that the action categorization implementation maintains all existing functionality without breaking changes. This includes automated test suites, UI behavior validation, and performance benchmarking.

## Priority

**HIGH** - Critical validation before deployment

## Dependencies

- **Blocks**: ACTCAT-005 (LLM prompt enhancement)
- **Blocks**: ACTCAT-009 (UI renderer refactoring)
- **Enables**: Production deployment

## Acceptance Criteria

- [ ] All existing test suites pass without modification
- [ ] UI behavior identical to pre-refactoring state
- [ ] LLM prompt output maintains compatibility while adding categorization
- [ ] Performance benchmarks within acceptable ranges (±5%)
- [ ] Memory usage stable (no leaks or excessive allocation)
- [ ] Error handling maintains current resilience
- [ ] Edge cases and boundary conditions handled correctly
- [ ] Integration between components remains stable

## Implementation Steps

### Step 1: Existing Test Suite Validation

**Goal**: Ensure all current tests pass without any modifications

```bash
# Run all existing test suites to establish baseline
npm run test:unit
npm run test:integration
npm run test:e2e

# Verify specific components
npm test -- tests/unit/domUI/actionButtonsRenderer.test.js
npm test -- tests/integration/prompting/
npm test -- tests/integration/containerConfig.test.js
```

**Validation Criteria**:

- [ ] 100% pass rate on existing unit tests
- [ ] 100% pass rate on existing integration tests
- [ ] 100% pass rate on existing end-to-end tests
- [ ] No test timeouts or flaky behavior
- [ ] Test execution time within ±10% of baseline

### Step 2: UI Behavior Regression Testing

**File**: `tests/regression/ui/actionButtonsRendererBehavior.test.js`

```javascript
/**
 * @file Action Buttons Renderer UI Behavior Regression Tests
 * Validates identical UI behavior after service integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import ActionButtonsRenderer from '../../../src/domUI/actionButtonsRenderer.js';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('ActionButtonsRenderer UI Behavior Regression', () => {
  let dom;
  let window;
  let document;
  let container;
  let renderer;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="actions-container"></div>
          <button id="player-confirm-turn-button">Send</button>
          <input id="speech-input" type="text" />
        </body>
      </html>
    `,
      { url: 'http://localhost' }
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    container = createTestContainerWithActionCategorization();

    renderer = new ActionButtonsRenderer({
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

  describe('Flat Action Rendering (No Categorization)', () => {
    it('should render flat actions identically to original', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait for a moment.',
        },
        {
          index: 2,
          actionId: 'core:go',
          commandString: 'go north',
          description: 'Move north.',
        },
        {
          index: 3,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss gently.',
        },
      ];

      // This should trigger flat rendering (< 6 actions)
      const result = renderer.renderActions(actions);

      // Verify flat structure (exact assertions depend on current implementation)
      const container = document.getElementById('actions-container');
      expect(container.children.length).toBe(actions.length);

      // Each action should be a direct child (no grouping structure)
      for (let i = 0; i < actions.length; i++) {
        const actionElement = container.children[i];
        expect(actionElement.textContent).toContain(actions[i].commandString);
        expect(actionElement.getAttribute('data-action-index')).toBe(
          actions[i].index.toString()
        );
      }
    });

    it('should handle edge cases in flat rendering', () => {
      const edgeCaseActions = [
        { index: 1, actionId: 'core:wait', commandString: '', description: '' },
        { index: 2, actionId: '', commandString: 'go', description: 'Move' },
        {
          index: 3,
          actionId: null,
          commandString: 'examine',
          description: 'Look',
        },
      ];

      expect(() => {
        renderer.renderActions(edgeCaseActions);
      }).not.toThrow();

      const container = document.getElementById('actions-container');
      expect(container.children.length).toBe(edgeCaseActions.length);
    });
  });

  describe('Grouped Action Rendering (With Categorization)', () => {
    it('should render grouped actions with correct structure', () => {
      const actions = [
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
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug.',
        },
        {
          index: 5,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove.',
        },
        {
          index: 6,
          actionId: 'clothing:wear',
          commandString: 'wear',
          description: 'Wear.',
        },
      ];

      renderer.renderActions(actions);

      const container = document.getElementById('actions-container');

      // Should have namespace group containers
      const groupElements = container.querySelectorAll('[data-namespace]');
      expect(groupElements.length).toBeGreaterThan(0);

      // Verify namespace order (core, intimacy, clothing)
      const namespaces = Array.from(groupElements).map((el) =>
        el.getAttribute('data-namespace')
      );
      expect(namespaces).toEqual(['core', 'intimacy', 'clothing']);

      // Verify actions are in correct groups
      const coreGroup = container.querySelector('[data-namespace="core"]');
      const coreActions = coreGroup.querySelectorAll('[data-action-index]');
      expect(coreActions.length).toBe(2);
      expect(coreActions[0].getAttribute('data-action-index')).toBe('1');
      expect(coreActions[1].getAttribute('data-action-index')).toBe('2');
    });

    it('should maintain action order within groups', () => {
      const actions = [
        {
          index: 5,
          actionId: 'core:examine',
          commandString: 'examine',
          description: 'Examine.',
        },
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        {
          index: 3,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go.',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug.',
        },
        {
          index: 6,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove.',
        },
      ];

      renderer.renderActions(actions);

      const coreGroup = document.querySelector('[data-namespace="core"]');
      const coreActionIndexes = Array.from(
        coreGroup.querySelectorAll('[data-action-index]')
      ).map((el) => parseInt(el.getAttribute('data-action-index')));

      // Should maintain original order: 5, 1, 3 (order from input array)
      expect(coreActionIndexes).toEqual([5, 1, 3]);
    });
  });

  describe('Event Handling Regression', () => {
    it('should maintain event handling behavior', () => {
      const mockEventDispatcher = { dispatch: jest.fn(), subscribe: jest.fn() };
      const rendererWithEvents = new ActionButtonsRenderer({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        documentContext: document,
        validatedEventDispatcher: mockEventDispatcher,
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
      ];

      rendererWithEvents.renderActions(actions);

      // Simulate click on action button
      const actionButton = document.querySelector('[data-action-index="1"]');
      expect(actionButton).toBeTruthy();

      actionButton.click();

      // Verify event was dispatched (behavior should be identical)
      expect(mockEventDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('Accessibility Regression', () => {
    it('should maintain accessibility attributes', () => {
      const actions = [
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
      ];

      renderer.renderActions(actions);

      const actionButtons = document.querySelectorAll('[data-action-index]');

      actionButtons.forEach((button) => {
        // Verify accessibility attributes are preserved
        expect(button.getAttribute('role')).toBeTruthy();
        expect(
          button.getAttribute('aria-label') || button.textContent
        ).toBeTruthy();
        expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      });
    });

    it('should maintain keyboard navigation', () => {
      const actions = Array.from({ length: 6 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 3}:action${i}`,
        commandString: `action ${i}`,
        description: `Description ${i}.`,
      }));

      renderer.renderActions(actions);

      const actionButtons = document.querySelectorAll('[data-action-index]');

      // Verify tab order is maintained
      actionButtons.forEach((button, index) => {
        expect(button.tabIndex).toBe(index);
      });
    });
  });

  describe('Error Handling Regression', () => {
    it('should handle malformed action data gracefully', () => {
      const malformedActions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        null,
        { index: 2 }, // Missing required fields
        { index: 3, actionId: null, commandString: '', description: null },
        {
          index: 4,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
      ];

      expect(() => {
        renderer.renderActions(malformedActions);
      }).not.toThrow();

      // Should render valid actions and skip invalid ones
      const actionButtons = document.querySelectorAll('[data-action-index]');
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it('should handle service errors without crashing', () => {
      // Mock service to throw errors
      const faultyService = {
        shouldUseGrouping: jest.fn(() => {
          throw new Error('Service error');
        }),
        groupActionsByNamespace: jest.fn(() => {
          throw new Error('Service error');
        }),
        formatNamespaceDisplayName: jest.fn(() => {
          throw new Error('Service error');
        }),
        extractNamespace: jest.fn(() => {
          throw new Error('Service error');
        }),
        getSortedNamespaces: jest.fn(() => {
          throw new Error('Service error');
        }),
      };

      const faultyRenderer = new ActionButtonsRenderer({
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

      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
      ];

      expect(() => {
        faultyRenderer.renderActions(actions);
      }).not.toThrow();

      // Should fall back to flat rendering
      const container = document.getElementById('actions-container');
      expect(container.children.length).toBeGreaterThan(0);
    });
  });
});
```

### Step 3: LLM Prompt Output Regression Testing

**File**: `tests/regression/prompting/aiPromptOutputRegression.test.js`

```javascript
/**
 * @file AI Prompt Output Regression Tests
 * Validates LLM prompt compatibility and enhancement
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AIPromptContentProvider from '../../../src/prompting/AIPromptContentProvider.js';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('AI Prompt Output Regression', () => {
  let container;
  let promptContentProvider;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();

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
        'IActionCategorizationService'
      ),
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
            actionId: 'intimacy:kiss',
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
            index: 7,
            actionId: 'clothing:remove',
            commandString: 'remove',
            description: 'Remove.',
          },
          {
            index: 2,
            actionId: 'intimacy:hug',
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

      expect(result).toBe('PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE');
    });

    it('should handle missing availableActions property', () => {
      const gameState = {};
      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(result).toBe('PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE');
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
            actionId: 'core:go',
            commandString: 'go north',
            description: 'Move to the north.',
          },
          {
            index: 3,
            actionId: 'intimacy:kiss',
            commandString: 'kiss Sarah',
            description: 'Kiss Sarah tenderly.',
          },
          {
            index: 4,
            actionId: 'intimacy:hug',
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
      expect(result).toContain('### INTIMACY Actions');
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
            actionId: 'intimacy:kiss',
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

      // Verify namespace order: core, intimacy, sex, anatomy, clothing, then alphabetical
      const coreIndex = result.indexOf('### CORE Actions');
      const intimacyIndex = result.indexOf('### INTIMACY Actions');
      const sexIndex = result.indexOf('### SEX Actions');
      const anatomyIndex = result.indexOf('### ANATOMY Actions');
      const clothingIndex = result.indexOf('### CLOTHING Actions');
      const unknownIndex = result.indexOf('### UNKNOWN Actions');

      expect(coreIndex).toBeLessThan(intimacyIndex);
      expect(intimacyIndex).toBeLessThan(sexIndex);
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
            actionId: 'intimacy:kiss',
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

    it('should handle very large action sets efficiently', () => {
      const largeActionSet = Array.from({ length: 100 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 10}:action${i}`,
        commandString: `command ${i}`,
        description: `Description for action number ${i}.`,
      }));

      const gameState = { availableActions: largeActionSet };

      const startTime = performance.now();
      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
      expect(result).toBeTruthy();
      expect(result).toContain('## Available Actions');
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
            actionId: 'intimacy:kiss',
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
            actionId: 'core:go',
            commandString: 'go',
            description: '',
          }, // Empty description
          {
            index: 6,
            actionId: 'intimacy:hug',
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
            actionId: 'intimacy:kiss',
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
            actionId: 'core:go',
            commandString: 'go to bedroom',
            description: 'Go.',
          },
          {
            index: 6,
            actionId: 'intimacy:hug',
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
```

### Step 4: Performance Benchmarking

**File**: `tests/regression/performance/actionCategorizationPerformance.test.js`

```javascript
/**
 * @file Action Categorization Performance Regression Tests
 * Validates performance characteristics after implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';
import AIPromptContentProvider from '../../../src/prompting/AIPromptContentProvider.js';

describe('Action Categorization Performance Regression', () => {
  let container;
  let service;
  let promptProvider;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();
    service = container.resolve('IActionCategorizationService');

    promptProvider = new AIPromptContentProvider({
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
      actionCategorizationService: service,
    });
  });

  describe('Service Performance', () => {
    it('should extract namespaces efficiently', () => {
      const actionIds = Array.from(
        { length: 1000 },
        (_, i) => `namespace${i % 10}:action${i}`
      );

      const startTime = performance.now();
      for (const actionId of actionIds) {
        service.extractNamespace(actionId);
      }
      const endTime = performance.now();

      const avgTime = (endTime - startTime) / actionIds.length;
      expect(avgTime).toBeLessThan(0.01); // <0.01ms per extraction
    });

    it('should handle grouping decisions efficiently', () => {
      const actions = Array.from({ length: 50 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 8}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.shouldUseGrouping(actions, config);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // <1ms per decision
    });

    it('should group actions efficiently', () => {
      const actions = Array.from({ length: 30 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 6}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.groupActionsByNamespace(actions, config);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(5); // <5ms per grouping
    });
  });

  describe('LLM Prompt Performance', () => {
    it('should format prompts with minimal overhead', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 5}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action ${i}.`,
        })),
      };

      const iterations = 20;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        promptProvider.getAvailableActionsInfoContent(gameState);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(10); // <10ms per prompt generation
    });

    it('should handle large action sets within reasonable time', () => {
      const gameState = {
        availableActions: Array.from({ length: 100 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 15}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action number ${i}.`,
        })),
      };

      const startTime = performance.now();
      const result = promptProvider.getAvailableActionsInfoContent(gameState);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // <50ms for 100 actions
      expect(result).toBeTruthy();
    });
  });

  describe('Memory Usage', () => {
    it('should not create memory leaks in repeated operations', () => {
      const actions = Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `test:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['test'],
        showCounts: false,
      };

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        service.shouldUseGrouping(actions, config);
        service.groupActionsByNamespace(actions, config);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // <1MB
    });
  });
});
```

### Step 5: Integration Stability Testing

**File**: `tests/regression/integration/systemIntegration.test.js`

```javascript
/**
 * @file System Integration Regression Tests
 * Validates integration stability across components
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('System Integration Regression', () => {
  let container;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();
  });

  describe('Dependency Injection Stability', () => {
    it('should resolve all services without circular dependencies', () => {
      expect(() => {
        container.resolve('IActionCategorizationService');
        container.resolve('IActionCategorizationConfigLoader');
      }).not.toThrow();
    });

    it('should maintain singleton behavior across components', () => {
      const service1 = container.resolve('IActionCategorizationService');
      const service2 = container.resolve('IActionCategorizationService');

      expect(service1).toBe(service2);
    });

    it('should handle container disposal gracefully', () => {
      const service = container.resolve('IActionCategorizationService');
      expect(service).toBeTruthy();

      expect(() => {
        if (container.dispose) {
          container.dispose();
        }
      }).not.toThrow();
    });
  });

  describe('Cross-Component Communication', () => {
    it('should maintain consistent configuration across components', () => {
      const service = container.resolve('IActionCategorizationService');
      const configLoader = container.resolve(
        'IActionCategorizationConfigLoader'
      );

      const uiConfig = configLoader.loadConfiguration('ui');
      const llmConfig = configLoader.loadConfiguration('llm');

      // Both should have same core structure but different UI-specific options
      expect(uiConfig.enabled).toBe(llmConfig.enabled);
      expect(uiConfig.minActionsForGrouping).toBe(
        llmConfig.minActionsForGrouping
      );
      expect(uiConfig.namespaceOrder).toEqual(llmConfig.namespaceOrder);

      // UI should show counts, LLM should not
      expect(uiConfig.showCounts).toBe(true);
      expect(llmConfig.showCounts).toBe(false);
    });
  });

  describe('Error Propagation', () => {
    it('should handle service errors without affecting other components', () => {
      // Create a scenario where one component fails
      const faultyService = {
        extractNamespace: () => {
          throw new Error('Service failure');
        },
        shouldUseGrouping: () => {
          throw new Error('Service failure');
        },
        groupActionsByNamespace: () => {
          throw new Error('Service failure');
        },
        getSortedNamespaces: () => {
          throw new Error('Service failure');
        },
        formatNamespaceDisplayName: () => {
          throw new Error('Service failure');
        },
      };

      // Replace service registration with faulty one
      container.register({
        token: 'IActionCategorizationService',
        factory: () => faultyService,
        lifetime: 'singleton',
      });

      // Other components should still function
      expect(() => {
        container.resolve('IActionCategorizationConfigLoader');
      }).not.toThrow();
    });
  });
});
```

## Performance Benchmarks and Targets

### Baseline Measurements

- [ ] **Current test execution time**: Measure existing test suite duration
- [ ] **Current UI rendering time**: Benchmark action button rendering
- [ ] **Current LLM prompt generation time**: Benchmark prompt formatting
- [ ] **Current memory usage**: Profile memory consumption

### Performance Targets

- [ ] **Test execution**: ±10% variance from baseline
- [ ] **UI rendering**: ±5% variance from baseline
- [ ] **LLM prompts**: ±5% variance from baseline
- [ ] **Memory usage**: No increase >100KB
- [ ] **Service operations**: <1ms per method call

### Monitoring and Reporting

- [ ] Automated performance reporting in CI
- [ ] Memory leak detection
- [ ] Performance regression alerts
- [ ] Benchmark tracking over time

## Quality Gates

### Test Coverage

- [ ] All existing tests pass without modification
- [ ] New regression tests achieve ≥95% coverage
- [ ] Performance tests validate all critical paths
- [ ] Integration tests cover cross-component scenarios

### Behavioral Validation

- [ ] UI behavior pixel-perfect match to original
- [ ] LLM output backward compatible with enhancements
- [ ] Error handling maintains current resilience
- [ ] Edge cases handled identically

### Performance Validation

- [ ] All benchmarks within target ranges
- [ ] No memory leaks detected
- [ ] Service call overhead minimal
- [ ] Large dataset performance acceptable

## Files Created

- [ ] `tests/regression/ui/actionButtonsRendererBehavior.test.js`
- [ ] `tests/regression/prompting/aiPromptOutputRegression.test.js`
- [ ] `tests/regression/performance/actionCategorizationPerformance.test.js`
- [ ] `tests/regression/integration/systemIntegration.test.js`

## Files Modified

- None (pure addition of regression tests)

## Dependencies

- **Completes**: ACTCAT-005, ACTCAT-009
- **Enables**: Production deployment

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All existing tests pass unmodified
- [ ] Regression tests pass with ≥95% coverage
- [ ] Performance benchmarks within targets
- [ ] UI behavior validation complete
- [ ] LLM output compatibility verified
- [ ] Integration stability confirmed
- [ ] Memory usage stable
- [ ] Code review approved
