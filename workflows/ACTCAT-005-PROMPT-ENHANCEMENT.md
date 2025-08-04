# ACTCAT-005: LLM Prompt Enhancement with Categorization

## Overview

Enhance the `AIPromptContentProvider.js` to use the new `ActionCategorizationService` for formatting available actions in LLM prompts. This includes implementing categorized markdown output when thresholds are met, while maintaining backward compatibility with existing flat formatting.

## Priority

**HIGH** - Core LLM enhancement for action categorization

## Dependencies

- **Blocks**: ACTCAT-001 (ActionCategorizationService)
- **Blocks**: ACTCAT-004 (Dependency injection integration)
- **Enables**: ACTCAT-008 (Integration testing)

## Acceptance Criteria

- [ ] Uses ActionCategorizationService through dependency injection
- [ ] Implements categorized markdown formatting when thresholds met
- [ ] Preserves action indexes exactly as before
- [ ] Falls back to flat formatting when appropriate
- [ ] Maintains backward compatibility with existing behavior
- [ ] Markdown structure is LLM-friendly and readable
- [ ] Error handling with graceful fallback to existing format
- [ ] Performance impact <5ms for typical action sets

## Implementation Steps

### Step 1: Analyze Current Implementation

**File to examine**: `src/prompting/AIPromptContentProvider.js`

First, let me examine the current implementation to understand the existing structure:

- Current method: `getAvailableActionsInfoContent(gameState)`
- Current formatting: Uses `_formatListSegment()` helper
- Current output format: Flat list with indexes

### Step 2: Add Service Dependency

**File**: `src/prompting/AIPromptContentProvider.js` (modify constructor)

```javascript
// Add import
import { tokens } from '../dependencyInjection/tokens.js';

// Update constructor to include the service
constructor({
  logger,
  promptStaticContentService,
  perceptionLogFormatter,
  gameStateValidationService,
  actionCategorizationService
}) {
  super();

  // Existing validation
  validateDependencies(
    [
      {
        dependency: logger,
        name: 'AIPromptContentProvider: logger',
        methods: ['info', 'warn', 'error', 'debug'],
      },
      {
        dependency: promptStaticContentService,
        name: 'AIPromptContentProvider: promptStaticContentService',
        methods: [
          'getCoreTaskDescriptionText',
          'getCharacterPortrayalGuidelines',
          'getNc21ContentPolicyText',
          'getFinalLlmInstructionText',
        ],
      },
      {
        dependency: perceptionLogFormatter,
        name: 'AIPromptContentProvider: perceptionLogFormatter',
        methods: ['format'],
      },
      {
        dependency: gameStateValidationService,
        name: 'AIPromptContentProvider: gameStateValidationService',
        methods: ['validate'],
      },
      {
        dependency: actionCategorizationService,
        name: 'AIPromptContentProvider: actionCategorizationService',
        methods: ['extractNamespace', 'shouldUseGrouping', 'groupActionsByNamespace', 'getSortedNamespaces', 'formatNamespaceDisplayName'],
      },
    ],
    logger
  );

  this.#logger = logger;
  this.#promptStaticContentService = promptStaticContentService;
  this.#perceptionLogFormatter = perceptionLogFormatter;
  this.#gameStateValidationService = gameStateValidationService;
  this.#actionCategorizationService = actionCategorizationService;
}
```

### Step 3: Update Main Method

**File**: `src/prompting/AIPromptContentProvider.js` (modify existing method)

**Note**: The ActionCategorizationService uses internal configuration, so no external config method is needed.

### Step 3: Implement Categorized Formatting Method

**File**: `src/prompting/AIPromptContentProvider.js` (add private method)

```javascript
/**
 * Format actions with categorization when appropriate
 * @private
 * @param {ActionComposite[]} actions - Array of actions to format
 * @returns {string} Formatted markdown content with categorized actions
 */
_formatCategorizedActions(actions) {
  try {
    const startTime = performance.now();

    this.#logger.debug('AIPromptContentProvider: Formatting categorized actions', {
      actionCount: actions.length
    });

    const grouped = this.#actionCategorizationService.groupActionsByNamespace(actions);

    if (grouped.size === 0) {
      this.#logger.warn('AIPromptContentProvider: Grouping returned empty result, falling back to flat format');
      return this._formatFlatActions(actions);
    }

    const segments = ['## Available Actions', ''];

    for (const [namespace, namespaceActions] of grouped) {
      const displayName = this.#actionCategorizationService.formatNamespaceDisplayName(namespace);
      segments.push(`### ${displayName} Actions`);

      for (const action of namespaceActions) {
        segments.push(this._formatSingleAction(action));
      }

      segments.push(''); // Empty line between sections
    }

    const duration = performance.now() - startTime;
    this.#logger.debug('AIPromptContentProvider: Categorized formatting completed', {
      duration: `${duration.toFixed(2)}ms`,
      namespaceCount: grouped.size,
      totalActions: actions.length
    });

    return segments.join('\n').trim();

  } catch (error) {
    this.#logger.error('AIPromptContentProvider: Error in categorized formatting, falling back to flat format', {
      error: error.message,
      actionCount: actions.length
    });

    // Graceful fallback to flat formatting
    return this._formatFlatActions(actions);
  }
}
```

### Step 4: Implement Flat Formatting Method

**File**: `src/prompting/AIPromptContentProvider.js` (add private method)

```javascript
/**
 * Format actions in flat (non-categorized) format
 * @private
 * @param {ActionComposite[]} actions - Array of actions to format
 * @returns {string} Formatted flat list content
 */
_formatFlatActions(actions) {
  this.#logger.debug('AIPromptContentProvider: Using flat action formatting', {
    actionCount: actions.length
  });

  return this._formatListSegment(
    'Choose one of the following available actions by its index',
    actions,
    this._formatSingleAction.bind(this),
    PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE
  );
}
```

### Step 5: Implement Single Action Formatting

**File**: `src/prompting/AIPromptContentProvider.js` (add private method)

```javascript
/**
 * Format individual action entry consistently
 * @private
 * @param {ActionComposite} action - Single action object to format
 * @returns {string} Formatted action line
 */
_formatSingleAction(action) {
  if (!action) {
    this.#logger.warn('AIPromptContentProvider: Attempted to format null/undefined action');
    return '';
  }

  const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
  let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;

  // Ensure description ends with punctuation for LLM readability
  description = ensureTerminalPunctuation(description);

  return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
}
```

### Step 6: Update Main Method

**File**: `src/prompting/AIPromptContentProvider.js` (modify existing method)

```javascript
/**
 * Format available actions info content with optional categorization
 * @param {Object} gameState - Current game state
 * @returns {string} Formatted actions content for LLM prompt
 */
getAvailableActionsInfoContent(gameState) {
  this.#logger.debug('AIPromptContentProvider: Formatting available actions info content.');

  const actions = gameState.availableActions || [];
  const noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

  // Handle empty or invalid actions
  if (!Array.isArray(actions) || actions.length === 0) {
    this.#logger.warn('AIPromptContentProvider: No available actions provided. Using fallback message.');
    return noActionsMessage;
  }

  try {
    // Check if we should use categorization
    if (this.#actionCategorizationService.shouldUseGrouping(actions)) {
      this.#logger.debug('AIPromptContentProvider: Using categorized formatting', {
        actionCount: actions.length
      });

      return this._formatCategorizedActions(actions);
    } else {
      this.#logger.debug('AIPromptContentProvider: Using flat formatting (thresholds not met)', {
        actionCount: actions.length
      });

      return this._formatFlatActions(actions);
    }

  } catch (error) {
    this.#logger.error('AIPromptContentProvider: Critical error in action formatting, using fallback', {
      error: error.message,
      actionCount: actions.length
    });

    // Ultimate fallback to original behavior
    return this._formatListSegment(
      'Choose one of the following available actions by its index',
      actions,
      (action) => {
        const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
        const description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
        return `[Index: ${action.index}] Command: "${commandStr}". Description: ${ensureTerminalPunctuation(description)}`;
      },
      noActionsMessage
    );
  }
}
```

### Step 7: Update DI Registration

**Note**: Action Categorization Service is already integrated into the base container configuration at `src/dependencyInjection/baseContainerConfig.js:103`. 

The AIPromptContentProvider registration will need to be updated in the appropriate registration file (likely within the AI registrations) to include the new dependency:

```javascript
// Update the AIPromptContentProvider registration to include the new dependency
container.register({
  token: tokens.IAIPromptContentProvider,
  factory: (c) =>
    new AIPromptContentProvider({
      logger: c.resolve(tokens.ILogger),
      promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
      perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
      gameStateValidationService: c.resolve(
        tokens.IGameStateValidationServiceForPrompting
      ),
      actionCategorizationService: c.resolve(tokens.IActionCategorizationService), // Add this line
    }),
  lifetime: 'singleton',
});
```

### Step 8: Create Integration Tests

**File**: `tests/integration/aiPromptContentProviderCategorization.test.js`

```javascript
/**
 * @file AIPromptContentProvider Categorization Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
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

  beforeEach(() => {
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
    configureBaseContainer(container, {
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
            actionId: 'core:go',
            commandString: 'go north',
            description: 'Move to the northern area.',
          },
          {
            index: 3,
            actionId: 'intimacy:kiss',
            commandString: 'kiss Sarah',
            description: 'Kiss Sarah gently.',
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
      expect(result).toContain('### INTIMACY Actions');
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
            actionId: 'intimacy:kiss',
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

      // Check that order follows priority: core, intimacy, sex, anatomy, clothing, then alphabetical
      const coreIndex = result.indexOf('### CORE Actions');
      const intimacyIndex = result.indexOf('### INTIMACY Actions');
      const sexIndex = result.indexOf('### SEX Actions');
      const anatomyIndex = result.indexOf('### ANATOMY Actions');
      const clothingIndex = result.indexOf('### CLOTHING Actions');

      expect(coreIndex).toBeLessThan(intimacyIndex);
      expect(intimacyIndex).toBeLessThan(sexIndex);
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
          { index: 3, actionId: 'intimacy:kiss' }, // Missing other fields
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

  describe('Performance', () => {
    it('should format large action sets efficiently', () => {
      const actions = Array.from({ length: 50 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 10}:action${i}`,
        commandString: `command ${i}`,
        description: `Description for action ${i}.`,
      }));

      const gameState = { availableActions: actions };

      const startTime = performance.now();
      const result =
        promptContentProvider.getAvailableActionsInfoContent(gameState);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should log performance metrics for categorized formatting', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 5}:action${i}`,
          commandString: `command ${i}`,
          description: `Description ${i}.`,
        })),
      };

      promptContentProvider.getAvailableActionsInfoContent(gameState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider: Categorized formatting completed',
        expect.objectContaining({
          duration: expect.stringMatching(/\d+\.\d+ms/),
          namespaceCount: expect.any(Number),
          totalActions: 20,
        })
      );
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
            actionId: 'intimacy:kiss',
            commandString: 'kiss',
            description: 'Kiss tenderly.',
          },
          {
            index: 3,
            actionId: 'core:go',
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
            actionId: 'intimacy:hug',
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
      expect(result).toMatch(/^### [A-Z]+ Actions$/m);

      // Check action format
      expect(result).toMatch(
        /^\[Index: \d+\] Command: ".+" Description: .+\.$/m
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
            actionId: 'intimacy:kiss',
            commandString: 'kiss',
            description: 'Kiss with punctuation.',
          },
          {
            index: 3,
            actionId: 'core:go',
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
            actionId: 'intimacy:hug',
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
```

## Quality Gates

### Functionality

- [ ] Categorized output when thresholds met
- [ ] Flat output when thresholds not met
- [ ] Action indexes preserved exactly
- [ ] Markdown structure valid and readable
- [ ] Graceful error handling with fallbacks

### Performance

- [ ] <5ms overhead for categorization decision
- [ ] <10ms total for typical action sets (5-20 actions)
- [ ] Performance logging for slow operations
- [ ] No memory leaks in repeated calls

### Compatibility

- [ ] All existing tests pass
- [ ] Backward compatibility maintained
- [ ] No breaking changes to public API
- [ ] Error fallback to existing behavior

### Quality

- [ ] Comprehensive error handling
- [ ] Appropriate logging levels
- [ ] Input validation and sanitization
- [ ] Code follows project patterns

## Files Created

- [ ] `tests/integration/aiPromptContentProviderCategorization.test.js`

## Files Modified

- [ ] `src/prompting/AIPromptContentProvider.js`
- [ ] Appropriate AI service registration file (location TBD - likely within AI registrations)

## Dependencies

- **Completes**: ACTCAT-001, ACTCAT-004
- **Enables**: ACTCAT-008

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Service integration working correctly
- [ ] Categorized output format implemented
- [ ] Fallback behavior working
- [ ] Performance targets achieved
- [ ] Integration tests pass
- [ ] No regression in existing functionality
- [ ] Code review approved
