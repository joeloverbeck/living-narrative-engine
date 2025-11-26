/**
 * @file Integration tests for action formatting with metadata.
 * Tests the end-to-end behavior of AIPromptContentProvider using
 * ModActionMetadataProvider with real service instances.
 * @see AIPromptContentProvider.js
 * @see ModActionMetadataProvider.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { ModActionMetadataProvider } from '../../../src/prompting/modActionMetadataProvider.js';
import ActionCategorizationService from '../../../src/entities/utils/ActionCategorizationService.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import { TEST_CATEGORIZATION_CONFIG } from '../../../src/entities/utils/actionCategorizationConfig.js';

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} Mock logger instance
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a mock data registry with configurable manifest data.
 *
 * @param {Object<string, object>} manifests - Map of mod IDs to manifest data
 * @returns {object} Mock data registry
 */
function createMockDataRegistry(manifests = {}) {
  return {
    get: jest.fn((type, id) => {
      if (type === 'mod_manifests') {
        return manifests[id.toLowerCase()];
      }
      return undefined;
    }),
    store: jest.fn(),
    getAll: jest.fn(() => Object.values(manifests)),
  };
}

/**
 * Creates mock static content service.
 *
 * @returns {object} Mock static content service
 */
function createMockStaticContentService() {
  return {
    getCoreTaskDescriptionText: jest.fn().mockReturnValue(''),
    getNc21ContentPolicyText: jest.fn().mockReturnValue(''),
    getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(''),
    getFinalLlmInstructionText: jest.fn().mockReturnValue(''),
  };
}

/**
 * Test configuration with lower thresholds for easier testing.
 * minActionsForGrouping: 3 (instead of 6)
 * minNamespacesForGrouping: 2
 */
const integrationTestConfig = {
  ...TEST_CATEGORIZATION_CONFIG,
  minActionsForGrouping: 2,
  minNamespacesForGrouping: 1,
};

describe('Action Formatting with Metadata - Integration', () => {
  let mockLogger;
  let mockDataRegistry;
  let modActionMetadataProvider;
  let aiPromptContentProvider;

  // Sample manifest data for testing
  const positioningManifest = {
    id: 'positioning',
    version: '1.0.0',
    name: 'Positioning System',
    actionPurpose: 'Change body position and spatial relationships relative to others.',
    actionConsiderWhen: 'Getting closer or farther, changing posture, adjusting facing direction.',
  };

  const itemsManifest = {
    id: 'items',
    version: '1.0.0',
    name: 'Items System',
    actionPurpose: 'Interact with objects through pickup, examination, use, and transfer.',
    actionConsiderWhen: 'Managing inventory, examining objects, sharing items, using functional items.',
  };

  const coreManifest = {
    id: 'core',
    version: '1.0.0',
    name: 'Core System',
    // No actionPurpose or actionConsiderWhen - tests graceful degradation
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDataRegistry = createMockDataRegistry({
      positioning: positioningManifest,
      items: itemsManifest,
      core: coreManifest,
    });

    // Create real ModActionMetadataProvider with mocked registry
    modActionMetadataProvider = new ModActionMetadataProvider({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });

    const safeEventDispatcher = { dispatch: jest.fn() };
    const perceptionLogFormatter = new PerceptionLogFormatter({ logger: mockLogger });
    const gameStateValidationService = new GameStateValidationServiceForPrompting({
      logger: mockLogger,
      safeEventDispatcher,
    });
    const actionCategorizationService = new ActionCategorizationService({
      logger: mockLogger,
      config: integrationTestConfig,
    });
    const characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn().mockReturnValue('<character/>'),
    };

    // Create real AIPromptContentProvider with real ModActionMetadataProvider
    aiPromptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: createMockStaticContentService(),
      perceptionLogFormatter,
      gameStateValidationService,
      actionCategorizationService,
      characterDataXmlBuilder,
      modActionMetadataProvider,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full integration with data registry', () => {
    it('should format actions with metadata from manifests', () => {
      // Note: Uses actionId (not id) - this is the field used by ActionCategorizationService
      const sampleActions = [
        {
          actionId: 'positioning:sit_down',
          commandString: 'sit down on bench',
          description: 'Take a seat on available furniture',
          index: 0,
        },
        {
          actionId: 'positioning:stand_up',
          commandString: 'stand up',
          description: 'Rise to standing position',
          index: 1,
        },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(sampleActions);

      expect(result).toContain('POSITIONING');
      expect(result).toContain('**Purpose:**');
      expect(result).toContain('Change body position');
      expect(result).toContain('**Consider when:**');
      expect(result).toContain('Getting closer or farther');
    });

    it('should verify output format matches expected LLM prompt structure', () => {
      const sampleActions = [
        { actionId: 'positioning:sit', commandString: 'sit', description: 'Sit down', index: 0 },
        { actionId: 'positioning:stand', commandString: 'stand', description: 'Stand up', index: 1 },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(sampleActions);

      // Verify structure matches spec
      expect(result).toMatch(/^## Available Actions/);
      expect(result).toMatch(/### [A-Z]+ Actions \(\d+ actions?\)/);
      expect(result).toMatch(/\*\*Purpose:\*\*/);
      expect(result).toMatch(/\*\*Consider when:\*\*/);
    });

    it('should handle mixed scenario: some mods have metadata, others do not', () => {
      const mixedActions = [
        { actionId: 'positioning:sit', commandString: 'sit', description: 'Sit', index: 0 },
        { actionId: 'core:wait', commandString: 'wait', description: 'Wait', index: 1 },
        { actionId: 'items:pickup', commandString: 'pick up', description: 'Pick up', index: 2 },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(mixedActions);

      // Positioning and items should have metadata
      expect(result).toContain('**Purpose:**');

      // Verify CORE section exists
      expect(result).toContain('CORE Actions');

      // The core section specifically should not have Purpose/Consider when
      const sections = result.split('###');
      const coreSection = sections.find((s) => s.includes('CORE'));
      expect(coreSection).toBeDefined();

      // Get the content between CORE header and the next section (or end)
      const coreSectionContent = coreSection.split('POSITIONING')[0] || coreSection;
      // Core has no actionPurpose in manifest, so it shouldn't appear in core section
      const coreLines = coreSectionContent.split('\n').slice(1); // Skip header line
      const corePurposeLine = coreLines.find((line) => line.includes('**Purpose:**'));
      expect(corePurposeLine).toBeUndefined();
    });

    it('should include items mod metadata when items actions are present', () => {
      const itemsActions = [
        { actionId: 'items:pickup', commandString: 'pick up', description: 'Pick up item', index: 0 },
        { actionId: 'items:drop', commandString: 'drop', description: 'Drop item', index: 1 },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(itemsActions);

      expect(result).toContain('ITEMS Actions');
      expect(result).toContain('Interact with objects');
      expect(result).toContain('Managing inventory');
    });
  });

  describe('Performance', () => {
    it('should format 100 actions from multiple mods within acceptable time', () => {
      const manyActions = [];
      const mods = ['positioning', 'items', 'core'];

      for (let i = 0; i < 100; i++) {
        const mod = mods[i % mods.length];
        manyActions.push({
          actionId: `${mod}:action_${i}`,
          commandString: `action ${i}`,
          description: `Description for action ${i}`,
          index: i,
        });
      }

      const startTime = performance.now();
      const result = aiPromptContentProvider._formatCategorizedActions(manyActions);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should cache metadata lookups efficiently', () => {
      const actions = [
        { actionId: 'positioning:sit', commandString: 'sit', description: 'Sit', index: 0 },
        { actionId: 'positioning:stand', commandString: 'stand', description: 'Stand', index: 1 },
        { actionId: 'positioning:walk', commandString: 'walk', description: 'Walk', index: 2 },
      ];

      aiPromptContentProvider._formatCategorizedActions(actions);

      // ModActionMetadataProvider caches internally - verify registry was called only once
      const positioningCalls = mockDataRegistry.get.mock.calls.filter(
        (call) => call[0] === 'mod_manifests' && call[1] === 'positioning'
      );
      expect(positioningCalls.length).toBe(1);
    });

    it('should verify cache persistence across multiple format calls', () => {
      const actions1 = [
        { actionId: 'positioning:sit', commandString: 'sit', description: 'Sit', index: 0 },
        { actionId: 'positioning:stand', commandString: 'stand', description: 'Stand', index: 1 },
      ];
      const actions2 = [
        { actionId: 'positioning:walk', commandString: 'walk', description: 'Walk', index: 0 },
        { actionId: 'positioning:run', commandString: 'run', description: 'Run', index: 1 },
      ];

      aiPromptContentProvider._formatCategorizedActions(actions1);
      aiPromptContentProvider._formatCategorizedActions(actions2);

      // Should still only have one registry call due to caching
      const positioningCalls = mockDataRegistry.get.mock.calls.filter(
        (call) => call[0] === 'mod_manifests' && call[1] === 'positioning'
      );
      expect(positioningCalls.length).toBe(1);
    });

    it('should refresh metadata after cache clear', () => {
      const actions = [
        { actionId: 'positioning:sit', commandString: 'sit', description: 'Sit', index: 0 },
        { actionId: 'positioning:stand', commandString: 'stand', description: 'Stand', index: 1 },
      ];

      aiPromptContentProvider._formatCategorizedActions(actions);
      modActionMetadataProvider.clearCache();
      aiPromptContentProvider._formatCategorizedActions(actions);

      // After cache clear, should have two registry calls
      const positioningCalls = mockDataRegistry.get.mock.calls.filter(
        (call) => call[0] === 'mod_manifests' && call[1] === 'positioning'
      );
      expect(positioningCalls.length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty actions array', () => {
      const result = aiPromptContentProvider._formatCategorizedActions([]);

      expect(result).toBeDefined();
      // Empty array falls back to flat format
      expect(typeof result).toBe('string');
    });

    it('should handle actions from unknown mods gracefully', () => {
      const unknownModActions = [
        { actionId: 'unknown_mod:action1', commandString: 'action1', description: 'Test', index: 0 },
        { actionId: 'unknown_mod:action2', commandString: 'action2', description: 'Test 2', index: 1 },
      ];

      // Should not throw
      expect(() => {
        const result = aiPromptContentProvider._formatCategorizedActions(unknownModActions);
        expect(result).toBeDefined();
        expect(result).toContain('UNKNOWN_MOD Actions');
        // Should not have Purpose/Consider when since manifest doesn't exist
        expect(result).not.toContain('**Purpose:**');
      }).not.toThrow();
    });

    it('should handle malformed action IDs without namespace', () => {
      const malformedActions = [
        { actionId: 'nonamespace', commandString: 'test', description: 'Test', index: 0 },
      ];

      // Should not throw
      expect(() => {
        aiPromptContentProvider._formatCategorizedActions(malformedActions);
      }).not.toThrow();
    });

    it('should handle actions with special characters in namespace', () => {
      const specialActions = [
        { actionId: 'my-mod:action', commandString: 'test', description: 'Test', index: 0 },
      ];

      expect(() => {
        const result = aiPromptContentProvider._formatCategorizedActions(specialActions);
        expect(result).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Real-world scenario simulation', () => {
    it('should format a realistic set of actions from multiple gameplay systems', () => {
      const gameplayActions = [
        // Positioning actions
        { actionId: 'positioning:sit_down', commandString: 'sit on couch', description: 'Take a seat', index: 0 },
        { actionId: 'positioning:get_close', commandString: 'approach Alice', description: 'Move closer', index: 1 },
        // Items actions
        { actionId: 'items:pick_up_item', commandString: 'pick up book', description: 'Pick up the book', index: 2 },
        { actionId: 'items:give_item', commandString: 'give book to Alice', description: 'Hand over the book', index: 3 },
        // Core actions
        { actionId: 'core:wait', commandString: 'wait', description: 'Wait for a moment', index: 4 },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(gameplayActions);

      // Verify all sections are present
      expect(result).toContain('POSITIONING Actions');
      expect(result).toContain('ITEMS Actions');
      expect(result).toContain('CORE Actions');

      // Verify metadata is shown for mods that have it
      expect(result).toContain('Change body position'); // positioning purpose
      expect(result).toContain('Interact with objects'); // items purpose

      // Verify action details are preserved
      expect(result).toContain('sit on couch');
      expect(result).toContain('pick up book');
      expect(result).toContain('wait');
    });
  });
});
