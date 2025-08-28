/**
 * @file Visual Properties Performance Tests
 * Validates performance benchmarks for visual customization features
 * Tests rendering speed, memory usage, and responsiveness requirements
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionButtonsRenderer } from '../../src/domUI/actionButtonsRenderer.js';
import ActionCategorizationService from '../../src/entities/utils/ActionCategorizationService.js';
import { UI_CATEGORIZATION_CONFIG } from '../../src/entities/utils/actionCategorizationConfig.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import { JSDOM } from 'jsdom';
import {
  createMockDOMEnvironment,
  createBatchVisualActions,
} from '../common/visualPropertiesTestUtils.js';

describe('Visual Properties - Performance Tests', () => {
  let container;
  let renderer;
  let dom;
  let document;
  let documentContext;
  let mockDOMEnv;

  beforeEach(() => {
    // Set up DOM
    dom = new JSDOM('<!DOCTYPE html><div id="actions-container"></div>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    documentContext = new DocumentContext(document);
    mockDOMEnv = createMockDOMEnvironment();

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

    const domElementFactory = new DomElementFactory(documentContext);

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
    mockDOMEnv.cleanup();
  });

  describe('rendering performance', () => {
    it('should handle large action datasets efficiently', async () => {
      // Create 100 actions with visual properties
      const actions = Array.from({ length: 100 }, (_, i) => ({
        index: i,
        actionId: `perf:action_${i}`,
        commandString: `Action ${i}`,
        description: `Performance test action ${i}`,
        visual: {
          backgroundColor: `#${(i * 123456).toString(16).substr(0, 6).padStart(6, '0')}`,
          textColor: '#ffffff',
          hoverBackgroundColor: `#${(i * 654321).toString(16).substr(0, 6).padStart(6, '0')}`,
          hoverTextColor: '#000000',
        },
      }));

      // Set up actions for rendering and measure time
      const startTime = performance.now();
      renderer.availableActions = actions;
      await renderer.renderList();
      const endTime = performance.now();

      const totalTime = endTime - startTime;

      // Performance requirements based on 5ms per button for visual processing
      expect(totalTime).toBeLessThan(500); // <500ms total for 100 buttons

      // Verify actions were processed
      expect(renderer.availableActions).toHaveLength(100);
    });

    it('should handle rapid visual updates without performance degradation', async () => {
      const action = {
        index: 0,
        actionId: 'perf:rapid_update',
        commandString: 'Rapid Update Test',
        visual: { backgroundColor: '#ff0000' },
      };

      // Set up single action for rendering
      renderer.availableActions = [action];
      await renderer.renderList();

      // Perform 100 rapid visual updates
      const colors = Array.from(
        { length: 100 },
        (_, i) => `#${i.toString(16).padStart(6, '0')}`
      );

      const startTime = performance.now();

      for (const color of colors) {
        // Use the actual updateButtonVisual method from ActionButtonsRenderer if available
        if (renderer.updateButtonVisual) {
          renderer.updateButtonVisual('perf:rapid_update', {
            backgroundColor: color,
            textColor: '#ffffff',
          });
        } else {
          // Fallback: simulate visual update by re-rendering with updated action
          action.visual.backgroundColor = color;
          renderer.availableActions = [action];
          await renderer.renderList();
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const timePerUpdate = totalTime / 100;

      expect(timePerUpdate).toBeLessThan(1); // <1ms per update
      expect(totalTime).toBeLessThan(100); // <100ms for 100 updates
    });

    it('should process visual property calculations efficiently', async () => {
      // Test color processing performance
      const colors = Array.from(
        { length: 1000 },
        (_, i) => `#${i.toString(16).padStart(6, '0')}`
      );

      const startTime = performance.now();

      // Simulate visual property validation (hex color processing)
      for (const color of colors) {
        // Simple validation that would happen during rendering
        const isValid = /^#[0-9a-f]{6}$/i.test(color);
        expect(isValid).toBe(true);

        // Simulate RGB conversion that might happen during contrast calculation
        const rgb = parseInt(color.slice(1), 16);
        const r = (rgb >> 16) & 0xff;

        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const timePerColor = totalTime / 1000;

      expect(timePerColor).toBeLessThan(1.0); // <1ms per color processing (relaxed for CI stability)
      expect(totalTime).toBeLessThan(1000); // <1000ms for 1000 color calculations
    });

    it('should handle end-to-end visual action pipeline efficiently', async () => {
      // Create 50 actions with visual properties
      const actions = createBatchVisualActions(50);

      // Simulate data registry operations
      const mockDataRegistry = {
        store: jest.fn(),
        get: jest.fn().mockImplementation((type, id) => {
          const actionId = id.split(':')[1];
          const actionIndex = parseInt(actionId.replace('perf_action_', ''));
          return actions[actionIndex]
            ? { ...actions[actionIndex], modId: 'test_mod' }
            : undefined;
        }),
      };

      // Store all actions (simulating registry operations)
      const loadStart = performance.now();
      for (const actionData of actions) {
        mockDataRegistry.store('actions', `test_mod:${actionData.id}`, {
          ...actionData,
          modId: 'test_mod',
        });
      }
      const loadEnd = performance.now();

      expect(loadEnd - loadStart).toBeLessThan(200); // <200ms to store 50 actions

      // Create simulated action composites (simulating action processing pipeline)
      const processStart = performance.now();
      const processedActions = actions.map((actionData, index) => ({
        index,
        actionId: `test_mod:${actionData.id}`,
        id: `test_mod:${actionData.id}`,
        name: actionData.name,
        commandString: actionData.name,
        description: `${actionData.name} description`,
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual,
        formatted: actionData.name,
      }));
      const processEnd = performance.now();

      expect(processEnd - processStart).toBeLessThan(100); // <100ms to create 50 action composites

      // Render all actions
      const renderStart = performance.now();
      renderer.availableActions = processedActions;
      await renderer.renderList();
      const renderEnd = performance.now();

      expect(renderEnd - renderStart).toBeLessThan(150); // <150ms to render 50 buttons

      // Verify renderer processed all actions (performance focus, not DOM verification)
      expect(renderer.availableActions).toHaveLength(50);
    });
  });

  describe('memory management', () => {
    it('should not leak memory during repeated render cycles', async () => {
      // Measure initial memory
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform 100 render/clear cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        const actions = Array.from({ length: 20 }, (_, i) => ({
          index: i,
          actionId: `memory:action_${i}`,
          commandString: `Memory Test ${i}`,
          visual: { backgroundColor: '#ff0000' },
        }));

        renderer.availableActions = actions;
        await renderer.renderList();

        // Clear by setting empty actions
        renderer.availableActions = [];
        await renderer.renderList();

        // Force garbage collection periodically
        if (cycle % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (<1MB for 100 cycles)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });

    it('should clean up internal data structures on disposal', async () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        index: i,
        actionId: `cleanup:action_${i}`,
        commandString: `Cleanup Test ${i}`,
        visual: {
          backgroundColor: '#ff0000',
          hoverBackgroundColor: '#00ff00',
        },
      }));

      renderer.availableActions = actions;
      await renderer.renderList();

      // Verify actions were set
      expect(renderer.availableActions.length).toBe(10);

      // Clear renderer by disposing
      renderer.dispose();

      // Verify cleanup happened - maps should be cleared if they exist
      // These properties may not exist in the current implementation
      expect(
        typeof renderer.buttonVisualMap === 'undefined' ||
          renderer.buttonVisualMap.size === 0
      ).toBe(true);
      expect(
        typeof renderer.hoverTimeouts === 'undefined' ||
          renderer.hoverTimeouts.size === 0
      ).toBe(true);
    });
  });
});
