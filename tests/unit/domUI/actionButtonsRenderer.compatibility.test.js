/**
 * @file ActionButtonsRenderer Backward Compatibility Tests
 * Ensures refactoring maintains identical behavior
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import ActionCategorizationService from '../../../src/entities/utils/ActionCategorizationService.js';
import { UI_CATEGORIZATION_CONFIG } from '../../../src/entities/utils/actionCategorizationConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { JSDOM } from 'jsdom';

// Mock dependencies
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');

describe('ActionButtonsRenderer Backward Compatibility', () => {
  let container;
  let renderer;
  let mockLogger;
  let mockEventDispatcher;
  let mockDomElementFactory;
  let dom;
  let document;
  let documentContext;

  beforeEach(() => {
    // Set up DOM
    dom = new JSDOM('<!DOCTYPE html><div id="actions-container"></div>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    documentContext = new DocumentContext(document);

    // Set up mocks
    mockLogger = new ConsoleLogger();
    mockEventDispatcher = new ValidatedEventDispatcher();

    // Create actual DomElementFactory instance
    mockDomElementFactory = new DomElementFactory({
      logger: mockLogger,
      documentContext: documentContext,
    });

    // Mock the button method to return real DOM elements
    jest
      .spyOn(mockDomElementFactory, 'button')
      .mockImplementation((text, className) => {
        const button = document.createElement('button');
        button.textContent = text;
        if (className) button.className = className;
        return button;
      });

    // Create container and register ActionCategorizationService with UI config
    container = new AppContainer();
    container.register(tokens.ILogger, mockLogger);
    container.register(
      tokens.IActionCategorizationService,
      new ActionCategorizationService({
        logger: mockLogger,
        config: UI_CATEGORIZATION_CONFIG,
      })
    );

    renderer = new ActionButtonsRenderer({
      logger: mockLogger,
      documentContext: documentContext,
      validatedEventDispatcher: mockEventDispatcher,
      domElementFactory: mockDomElementFactory,
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: container.resolve(
        tokens.IActionCategorizationService
      ),
    });
  });

  afterEach(() => {
    if (renderer && renderer.dispose) {
      renderer.dispose();
    }
    if (container && container.dispose) {
      container.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Namespace Extraction Compatibility', () => {
    it('should extract namespaces identically to original implementation', () => {
      const testCases = [
        { input: 'core:wait', expected: 'core' },
        { input: 'intimacy:kiss', expected: 'intimacy' },
        { input: 'clothing:remove_shirt', expected: 'clothing' },
        { input: 'no_colon_action', expected: 'unknown' },
        { input: 'none', expected: 'none' },
        { input: 'self', expected: 'self' },
        { input: '', expected: 'unknown' },
        { input: null, expected: 'unknown' },
        { input: undefined, expected: 'unknown' },
      ];

      const service = container.resolve(tokens.IActionCategorizationService);

      for (const { input, expected } of testCases) {
        const result = service.extractNamespace(input);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Grouping Decision Compatibility', () => {
    it('should make grouping decisions identically to original', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Test case: sufficient actions and namespaces
      const sufficientActions = [
        { actionId: 'core:wait' },
        { actionId: 'movement:go' },
        { actionId: 'intimacy:kiss' },
        { actionId: 'intimacy:hug' },
        { actionId: 'clothing:remove' },
        { actionId: 'clothing:wear' },
      ];

      expect(service.shouldUseGrouping(sufficientActions)).toBe(true);

      // Test case: insufficient actions
      const insufficientActions = [
        { actionId: 'core:wait' },
        { actionId: 'intimacy:kiss' },
      ];

      expect(service.shouldUseGrouping(insufficientActions)).toBe(false);

      // Test case: insufficient namespaces (only 1 namespace)
      const singleNamespaceActions = [
        { actionId: 'core:wait' },
        { actionId: 'core:examine' },
        { actionId: 'core:speak' },
        { actionId: 'core:follow' },
        { actionId: 'core:rest' },
        { actionId: 'core:sleep' },
      ];

      expect(service.shouldUseGrouping(singleNamespaceActions)).toBe(false);
    });
  });

  describe('Grouping Behavior Compatibility', () => {
    it('should group actions identically to original implementation', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      const actions = [
        { index: 1, actionId: 'clothing:remove' },
        { index: 2, actionId: 'core:wait' },
        { index: 3, actionId: 'intimacy:kiss' },
        { index: 4, actionId: 'movement:go' },
        { index: 5, actionId: 'clothing:wear' },
        { index: 6, actionId: 'intimacy:hug' },
      ];

      const grouped = service.groupActionsByNamespace(actions);

      // Verify grouping structure
      expect(grouped.size).toBe(4);
      expect(grouped.has('core')).toBe(true);
      expect(grouped.has('intimacy')).toBe(true);
      expect(grouped.has('clothing')).toBe(true);
      expect(grouped.has('movement')).toBe(true);

      // Verify group contents
      expect(grouped.get('core')).toHaveLength(1);
      expect(grouped.get('intimacy')).toHaveLength(2);
      expect(grouped.get('clothing')).toHaveLength(2);
      expect(grouped.get('movement')).toHaveLength(1);

      // Verify action preservation
      expect(grouped.get('core')[0].index).toBe(2); // Only core action
      expect(grouped.get('movement')[0].index).toBe(4); // Only movement action
      expect(grouped.get('intimacy')[0].index).toBe(3); // First intimacy action
      expect(grouped.get('intimacy')[1].index).toBe(6); // Second intimacy action
      expect(grouped.get('clothing')[0].index).toBe(1); // First clothing action
      expect(grouped.get('clothing')[1].index).toBe(5); // Second clothing action
    });

    it('should maintain namespace order identically to original', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      const namespaces = [
        'anatomy',
        'unknown',
        'core',
        'zebra',
        'intimacy',
        'clothing',
        'alpha',
      ];
      const sorted = service.getSortedNamespaces(namespaces);

      // Priority order first: core, intimacy, clothing, anatomy
      // Then alphabetical: alpha, unknown, zebra
      // Note: 'sex' is in the config but not in our test data
      expect(sorted).toEqual([
        'core',
        'intimacy',
        'anatomy',
        'clothing',
        'alpha',
        'unknown',
        'zebra',
      ]);
    });
  });

  describe('Display Name Formatting Compatibility', () => {
    it('should format display names identically to original', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      const testCases = [
        { input: 'core', expected: 'CORE' },
        { input: 'intimacy', expected: 'INTIMACY' },
        { input: 'unknown', expected: 'OTHER' },
        { input: 'custom_namespace', expected: 'CUSTOM_NAMESPACE' },
      ];

      for (const { input, expected } of testCases) {
        const result = service.formatNamespaceDisplayName(input);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle errors gracefully like original implementation', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Should not throw for invalid inputs
      expect(() => service.extractNamespace(null)).not.toThrow();
      expect(() => service.shouldUseGrouping(null)).not.toThrow();
      expect(() => service.groupActionsByNamespace(null)).not.toThrow();
      expect(() => service.getSortedNamespaces(null)).not.toThrow();

      // Should return appropriate fallback values
      expect(service.extractNamespace(null)).toBe('unknown');
      expect(service.shouldUseGrouping(null)).toBe(false);
      expect(service.groupActionsByNamespace(null)).toEqual(new Map());
      expect(service.getSortedNamespaces(null)).toEqual([]);
    });
  });

  describe('Performance Compatibility', () => {
    it('should maintain performance characteristics', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Create large action set
      const actions = Array.from({ length: 100 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 10}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const startTime = performance.now();

      const shouldGroup = service.shouldUseGrouping(actions);
      if (shouldGroup) {
        const grouped = service.groupActionsByNamespace(actions);
        const namespaces = [...grouped.keys()];
        service.getSortedNamespaces(namespaces);
      }

      const endTime = performance.now();

      // Should complete in reasonable time (same as original)
      expect(endTime - startTime).toBeLessThan(20); // 20ms threshold
    });
  });

  describe('UI Configuration Change', () => {
    it('should now show counts as per UI_CATEGORIZATION_CONFIG', async () => {
      // Create test actions
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
        {
          index: 2,
          actionId: 'movement:go',
          commandString: 'go',
          description: 'Go',
        },
        {
          index: 3,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug',
        },
        {
          index: 5,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove',
        },
        {
          index: 6,
          actionId: 'clothing:wear',
          commandString: 'wear',
          description: 'Wear',
        },
      ];

      // Update available actions
      renderer.availableActions = actions;

      // Render the list
      await renderer.renderList();

      // Check that section headers now include counts
      const container = document.querySelector('#actions-container');
      const headers = container.querySelectorAll('.action-section-header');

      // Should have 4 headers (core, intimacy, clothing, movement)
      expect(headers.length).toBe(4);

      // Headers should now include counts as per UI_CATEGORIZATION_CONFIG
      // Order is based on priority: core, intimacy, clothing (in priority order), then movement (alphabetical)
      expect(headers[0].textContent).toBe('CORE (1)');
      expect(headers[1].textContent).toBe('INTIMACY (2)');
      expect(headers[2].textContent).toBe('CLOTHING (2)');
      expect(headers[3].textContent).toBe('MOVEMENT (1)');
    });

    it('should not show counts when showCounts is false', async () => {
      // Create a service with showCounts disabled
      const noCountsService = new ActionCategorizationService({
        logger: mockLogger,
        config: {
          ...UI_CATEGORIZATION_CONFIG,
          showCounts: false,
        },
      });

      // Create renderer with no-counts service
      const noCountsRenderer = new ActionButtonsRenderer({
        logger: mockLogger,
        documentContext: documentContext,
        validatedEventDispatcher: mockEventDispatcher,
        domElementFactory: mockDomElementFactory,
        actionButtonsContainerSelector: '#actions-container',
        actionCategorizationService: noCountsService,
      });

      // Create test actions (need at least 6 actions and 2 namespaces for grouping)
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
        {
          index: 2,
          actionId: 'core:examine',
          commandString: 'examine',
          description: 'Examine',
        },
        {
          index: 3,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug',
        },
        {
          index: 5,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove',
        },
        {
          index: 6,
          actionId: 'clothing:wear',
          commandString: 'wear',
          description: 'Wear',
        },
      ];

      // Update available actions
      noCountsRenderer.availableActions = actions;

      // Render the list
      await noCountsRenderer.renderList();

      // Check that section headers do not include counts
      const container = document.querySelector('#actions-container');
      const headers = container.querySelectorAll('.action-section-header');

      // Should have 3 headers (core, intimacy, clothing)
      expect(headers.length).toBe(3);

      // Headers should NOT include counts when showCounts is false
      expect(headers[0].textContent).toBe('CORE');
      expect(headers[1].textContent).toBe('INTIMACY');
      expect(headers[2].textContent).toBe('CLOTHING');

      // Clean up
      noCountsRenderer.dispose();
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should integrate seamlessly with existing renderer methods', async () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
          params: {},
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss',
          params: {},
        },
      ];

      // Update available actions
      renderer.availableActions = actions;

      // Test that rendering methods still work
      await expect(renderer.renderList()).resolves.not.toThrow();

      // Verify the DOM was updated
      const container = document.querySelector('#actions-container');
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });
  });
});
