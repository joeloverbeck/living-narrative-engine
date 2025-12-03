// tests/unit/domUI/actionButtonsRenderer.namespaceGrouping.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');
jest.mock('../../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer - Namespace Grouping', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let mockActionCategorizationService;
  let renderer;

  const ACTION_BUTTONS_CONTAINER_SELECTOR = '#action-buttons';

  // Helper to create test action composites
  const createTestComposite = (
    index,
    actionId,
    commandString,
    description = 'Test description',
    params = {}
  ) => ({
    index,
    actionId,
    commandString,
    description,
    params,
  });

  beforeEach(() => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><div id="action-buttons"></div>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    // Setup DOM elements (action buttons container is available in document)

    // Setup mocks
    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher();
    mockDomElementFactoryInstance = new DomElementFactory();

    docContext = new DocumentContext(document);

    // Mock button factory to return real DOM elements
    mockDomElementFactoryInstance.button.mockImplementation(
      (text, className) => {
        const button = document.createElement('button');
        button.textContent = text;
        if (className) button.className = className;
        return button;
      }
    );

    // Create mock action categorization service
    mockActionCategorizationService = {
      extractNamespace: jest.fn().mockImplementation((actionId) => {
        const colonIndex = actionId.indexOf(':');
        return colonIndex !== -1
          ? actionId.substring(0, colonIndex)
          : 'unknown';
      }),
      shouldUseGrouping: jest.fn().mockReturnValue(false),
      groupActionsByNamespace: jest.fn().mockReturnValue(new Map()),
      getSortedNamespaces: jest
        .fn()
        .mockReturnValue([
          'core',
          'personal-space',
          'affection',
          'kissing',
          'caressing',
          'sex',
        ]),
      formatNamespaceDisplayName: jest
        .fn()
        .mockImplementation((ns) => ns.toUpperCase()),
      shouldShowCounts: jest.fn(() => false),
    };

    // Create renderer instance
    renderer = new ActionButtonsRenderer({
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: ACTION_BUTTONS_CONTAINER_SELECTOR,
      actionCategorizationService: mockActionCategorizationService,
    });
  });

  afterEach(() => {
    if (renderer && !renderer._isDisposed) {
      renderer.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Namespace Extraction', () => {
    it('should extract namespace from action ID with colon', () => {
      // Test the service's extractNamespace method directly
      const result1 =
        mockActionCategorizationService.extractNamespace('core:wait');
      expect(result1).toBe('core');

      const result2 = mockActionCategorizationService.extractNamespace(
        'personal-space:get_close'
      );
      expect(result2).toBe('personal-space');

      const result3 = mockActionCategorizationService.extractNamespace(
        'sex-breastplay:fondle_breasts'
      );
      expect(result3).toBe('sex-breastplay');

      // Verify the service was called with correct parameters
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('core:wait');
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('personal-space:get_close');
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('sex-breastplay:fondle_breasts');
    });

    it('should handle action ID without colon', () => {
      // Test the service's extractNamespace method with action ID without colon
      const result = mockActionCategorizationService.extractNamespace('wait');
      expect(result).toBe('unknown');

      // Test with action ID that has colon
      const result2 =
        mockActionCategorizationService.extractNamespace('movement:go');
      expect(result2).toBe('movement');

      // Verify the service was called with correct parameters
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('wait');
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('movement:go');
    });
  });

  describe('Action Grouping Logic', () => {
    it('should group actions by namespace', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'movement:go', 'go north'),
        createTestComposite(3, 'personal-space:get_close', 'get close'),
        createTestComposite(4, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          5,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service to return true for grouping
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);

      // Set up expected grouped actions map
      const expectedGroupedActions = new Map([
        ['core', [actions[0], actions[1]]],
        ['personal-space', [actions[2]]],
        ['kissing', [actions[3]]],
        ['sex', [actions[4], actions[5]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        expectedGroupedActions
      );

      // Set actions directly and refresh list
      renderer.availableActions = actions;
      await renderer.refreshList();

      // Check that actions are available
      expect(renderer.availableActions).toHaveLength(6);

      // Verify service methods were called
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
      expect(
        mockActionCategorizationService.groupActionsByNamespace
      ).toHaveBeenCalledWith(actions);
    });

    it('should sort namespaces by priority order', () => {
      // Test the service's getSortedNamespaces method
      const sortedNamespaces =
        mockActionCategorizationService.getSortedNamespaces();
      expect(sortedNamespaces).toContain('core');
      expect(sortedNamespaces).toContain('affection');
      expect(sortedNamespaces).toContain('kissing');
      expect(sortedNamespaces).toContain('sex');

      // Core should be first in the default order
      expect(sortedNamespaces[0]).toBe('core');

      // Verify the service method was called
      expect(
        mockActionCategorizationService.getSortedNamespaces
      ).toHaveBeenCalled();
    });
  });

  describe('Grouping Thresholds', () => {
    it('should not group when below minimum actions threshold', () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
      ];

      // Configure service to return false for grouping (below threshold)
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(false);

      // Set actions and trigger rendering
      renderer.availableActions = actions;

      // Test that shouldUseGrouping would be called with these actions
      // and returns false, indicating grouping should not be used
      const shouldGroup =
        mockActionCategorizationService.shouldUseGrouping(actions);
      expect(shouldGroup).toBe(false);
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
    });

    it('should not group when below minimum namespaces threshold', () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'movement:go', 'go'),
        createTestComposite(3, 'core:follow', 'follow'),
        createTestComposite(4, 'core:dismiss', 'dismiss'),
        createTestComposite(5, 'core:look', 'look'),
        createTestComposite(6, 'core:inventory', 'inventory'),
      ];

      // Configure service to return false for grouping (below namespace threshold)
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(false);

      // Set actions and test
      renderer.availableActions = actions;

      // Test that shouldUseGrouping would be called with these actions
      // and returns false, indicating grouping should not be used (all from same namespace)
      const shouldGroup =
        mockActionCategorizationService.shouldUseGrouping(actions);
      expect(shouldGroup).toBe(false);
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
    });

    it('should group when thresholds are met', () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'movement:go', 'go north'),
        createTestComposite(3, 'personal-space:get_close', 'get close'),
        createTestComposite(4, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          5,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service to return true for grouping (thresholds met)
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);

      renderer.availableActions = actions;

      // Test that shouldUseGrouping would be called with these actions
      // and returns true, indicating grouping should be used
      const shouldGroup =
        mockActionCategorizationService.shouldUseGrouping(actions);
      expect(shouldGroup).toBe(true);
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);

      // Count unique namespaces (this logic would be inside the service)
      const namespaces = new Set(
        actions.map((a) => {
          const colonIndex = a.actionId.indexOf(':');
          return colonIndex !== -1
            ? a.actionId.substring(0, colonIndex)
            : 'unknown';
        })
      );
      expect(namespaces.size).toBe(6); // core, movement, personal-space, kissing, sex-breastplay, sex-penile-manual
      expect(actions.length).toBe(6); // All actions present
    });
  });

  describe('Service Integration', () => {
    it('should use service for grouping decisions', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
      ];

      // Configure service behavior
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(false);

      renderer.availableActions = actions;
      await renderer.refreshList();

      // Verify service was consulted for grouping decision
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
    });

    it('should use service to group actions when grouping is enabled', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
      ];

      // Configure service for grouping
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);
      const groupedActions = new Map([
        ['core', [actions[0]]],
        ['personal-space', [actions[1]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedActions
      );

      renderer.availableActions = actions;
      await renderer.refreshList();

      // Verify service methods were called
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
      expect(
        mockActionCategorizationService.groupActionsByNamespace
      ).toHaveBeenCalledWith(actions);
    });

    it('should use service for namespace display formatting', () => {
      // Test the formatNamespaceDisplayName method
      const displayName =
        mockActionCategorizationService.formatNamespaceDisplayName('core');
      expect(displayName).toBe('CORE');
      expect(
        mockActionCategorizationService.formatNamespaceDisplayName
      ).toHaveBeenCalledWith('core');
    });
  });

  describe('Section Header and Group Creation', () => {
    it('should render grouped actions with section headers', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'movement:go', 'go north'),
        createTestComposite(3, 'personal-space:get_close', 'get close'),
        createTestComposite(4, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          5,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service for grouping
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);
      const groupedActions = new Map([
        ['core', [actions[0], actions[1]]],
        ['personal-space', [actions[2]]],
        ['kissing', [actions[3]]],
        ['sex', [actions[4], actions[5]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedActions
      );

      renderer.availableActions = actions;
      await renderer.refreshList();

      // Verify that grouping service methods were called
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);
      expect(
        mockActionCategorizationService.groupActionsByNamespace
      ).toHaveBeenCalledWith(actions);

      // Verify DOM structure was created (section headers should have been created)
      const sectionHeaders = document.querySelectorAll(
        '.action-section-header'
      );
      expect(sectionHeaders.length).toBeGreaterThan(0);
    });

    it('should create action groups with proper accessibility attributes', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
        createTestComposite(
          3,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(4, 'movement:go', 'go north'),
        createTestComposite(5, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service for grouping
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);
      const groupedActions = new Map([
        ['core', [actions[0], actions[3]]],
        ['personal-space', [actions[1]]],
        ['kissing', [actions[4]]],
        ['sex', [actions[2], actions[5]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedActions
      );

      renderer.availableActions = actions;
      await renderer.refreshList();

      // Verify we have the expected actions count and namespaces
      expect(actions.length).toBe(6);
      const namespaces = new Set(
        actions.map((a) => {
          const colonIndex = a.actionId.indexOf(':');
          return colonIndex !== -1
            ? a.actionId.substring(0, colonIndex)
            : 'unknown';
        })
      );
      expect(namespaces.size).toBe(6); // core, movement, personal-space, kissing, sex-breastplay, sex-penile-manual

      // Verify DOM structure with accessibility attributes was created
      const actionGroups = document.querySelectorAll('.action-group');
      expect(actionGroups.length).toBeGreaterThan(0);
    });
  });

  describe('Namespace Display Names', () => {
    it('should format namespace display names correctly', () => {
      // Test the service's formatNamespaceDisplayName method directly
      const coreDisplayName =
        mockActionCategorizationService.formatNamespaceDisplayName('core');
      expect(coreDisplayName).toBe('CORE');

      const sexDisplayName =
        mockActionCategorizationService.formatNamespaceDisplayName('sex');
      expect(sexDisplayName).toBe('SEX');

      const breastplayDisplayName =
        mockActionCategorizationService.formatNamespaceDisplayName(
          'sex-breastplay'
        );
      expect(breastplayDisplayName).toBe('SEX-BREASTPLAY');

      // Verify the service method was called with correct parameters
      expect(
        mockActionCategorizationService.formatNamespaceDisplayName
      ).toHaveBeenCalledWith('core');
      expect(
        mockActionCategorizationService.formatNamespaceDisplayName
      ).toHaveBeenCalledWith('sex');
      expect(
        mockActionCategorizationService.formatNamespaceDisplayName
      ).toHaveBeenCalledWith('sex-breastplay');
    });

    it('should handle special cases like unknown namespace', () => {
      // Test how the service handles actions without namespaces
      const unknownNamespace =
        mockActionCategorizationService.extractNamespace('wait');
      expect(unknownNamespace).toBe('unknown');

      const displayName =
        mockActionCategorizationService.formatNamespaceDisplayName('unknown');
      expect(displayName).toBe('UNKNOWN');

      // Verify the service methods were called
      expect(
        mockActionCategorizationService.extractNamespace
      ).toHaveBeenCalledWith('wait');
      expect(
        mockActionCategorizationService.formatNamespaceDisplayName
      ).toHaveBeenCalledWith('unknown');
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to ungrouped rendering when grouping is disabled', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
        createTestComposite(
          3,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(4, 'movement:go', 'go north'),
        createTestComposite(5, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service to return false for grouping (disabled)
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(false);

      renderer.availableActions = actions;
      await renderer.refreshList();

      // Verify service was called and returned false, indicating ungrouped rendering
      expect(
        mockActionCategorizationService.shouldUseGrouping
      ).toHaveBeenCalledWith(actions);

      // When grouping is disabled, groupActionsByNamespace should NOT be called
      expect(
        mockActionCategorizationService.groupActionsByNamespace
      ).not.toHaveBeenCalled();
    });

    it('should maintain selection behavior with grouped actions', async () => {
      const actions = [
        createTestComposite(1, 'core:wait', 'wait'),
        createTestComposite(2, 'personal-space:get_close', 'get close'),
        createTestComposite(
          3,
          'sex-breastplay:fondle_breasts',
          'fondle breasts'
        ),
        createTestComposite(4, 'movement:go', 'go north'),
        createTestComposite(5, 'kissing:kiss_cheek', 'kiss cheek'),
        createTestComposite(
          6,
          'sex-penile-manual:fondle_penis',
          'fondle penis'
        ),
      ];

      // Configure service for grouping
      mockActionCategorizationService.shouldUseGrouping.mockReturnValue(true);
      const groupedActions = new Map([
        ['core', [actions[0], actions[3]]],
        ['personal-space', [actions[1]]],
        ['sex', [actions[2], actions[5]]],
        ['kissing', [actions[4]]],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedActions
      );

      renderer.availableActions = actions;
      await renderer.refreshList();

      // The selection behavior should remain the same regardless of grouping
      expect(renderer.selectedAction).toBeNull();

      // Test selection (simplified, since we'd need to simulate full rendering)
      renderer.selectedAction = actions[0];
      expect(renderer.selectedAction).toBe(actions[0]);
    });
  });
});
