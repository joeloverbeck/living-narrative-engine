/**
 * @file ActionButtonsRenderer Performance Tests
 * Validates performance benchmarks and timing requirements
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
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { JSDOM } from 'jsdom';

describe('ActionButtonsRenderer Performance Validation', () => {
  let container;
  let renderer;
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

    // Create container with services
    container = new AppContainer();
    const logger = new ConsoleLogger();
    container.register(tokens.ILogger, logger);
    container.register(
      tokens.IActionCategorizationService,
      new ActionCategorizationService({
        logger: logger,
        config: UI_CATEGORIZATION_CONFIG,
      })
    );

    const mockEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    const domElementFactory = new DomElementFactory({
      logger: logger,
      documentContext: documentContext,
    });

    renderer = new ActionButtonsRenderer({
      logger: logger,
      documentContext: documentContext,
      validatedEventDispatcher: mockEventDispatcher,
      domElementFactory: domElementFactory,
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
  });

  it('should maintain performance for large action sets', async () => {
    const actions = Array.from({ length: 50 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 8}:action${i}`,
      commandString: `command ${i}`,
      description: `Description for action ${i}`,
    }));

    renderer.availableActions = actions;

    const iterations = 10;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      await renderer.renderList();

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);

    // Performance targets
    expect(avgTime).toBeLessThan(10); // 10ms average
    expect(maxTime).toBeLessThan(20); // 20ms maximum
  });

  it('should handle categorization operations efficiently', () => {
    const service = container.resolve(tokens.IActionCategorizationService);

    const actions = Array.from({ length: 100 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 10}:action${i}`,
      commandString: `command ${i}`,
      description: `Description ${i}`,
    }));

    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const shouldGroup = service.shouldUseGrouping(actions);
      if (shouldGroup) {
        const grouped = service.groupActionsByNamespace(actions);
        const namespaces = [...grouped.keys()];
        service.getSortedNamespaces(namespaces);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerIteration = totalTime / iterations;

    // Should maintain sub-millisecond performance per iteration
    expect(avgTimePerIteration).toBeLessThan(1);
  });

  it('should handle rapid re-renders efficiently', async () => {
    const actionSets = [
      // Small set
      Array.from({ length: 5 }, (_, i) => ({
        index: i + 1,
        actionId: `core:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      })),
      // Medium set with grouping
      Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 4}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      })),
      // Large set
      Array.from({ length: 50 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 10}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      })),
    ];

    const startTime = performance.now();

    // Simulate rapid updates
    for (let i = 0; i < 10; i++) {
      for (const actions of actionSets) {
        renderer.availableActions = actions;
        await renderer.renderList();
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should handle 30 renders (10 iterations × 3 sets) efficiently
    expect(totalTime).toBeLessThan(300); // 10ms average per render
  });

  it('should maintain service call overhead under threshold', () => {
    const service = container.resolve(tokens.IActionCategorizationService);
    const actionId = 'core:wait';

    // Warm up
    for (let i = 0; i < 100; i++) {
      service.extractNamespace(actionId);
    }

    const iterations = 10000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      service.extractNamespace(actionId);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerCall = (totalTime / iterations) * 1000; // Convert to microseconds

    // Service call overhead should be minimal (< 1 microsecond)
    expect(avgTimePerCall).toBeLessThan(1);
  });

  it('should handle edge cases without performance degradation', async () => {
    const edgeCases = [
      // Empty actions
      [],
      // Single action
      [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
          params: {},
        },
      ],
      // Actions with invalid data
      [
        {
          index: 1,
          actionId: null,
          commandString: 'invalid',
          description: 'Invalid',
          params: {},
        },
        {
          index: 2,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
          params: {},
        },
      ],
      // Large number of unique namespaces
      Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `unique${i}:action`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
        params: {},
      })),
    ];

    for (const actions of edgeCases) {
      renderer.availableActions = actions;

      const startTime = performance.now();
      await renderer.renderList();
      const endTime = performance.now();

      // Each edge case should render within reasonable time
      // Note: JSDOM and system variability can cause occasional spikes
      expect(endTime - startTime).toBeLessThan(50);
    }
  });
});
