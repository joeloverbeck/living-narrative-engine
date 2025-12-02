/**
 * @file VisualizationComposer Performance Tests
 * Validates O(n) linear scaling for parent-child index optimization (ANAGRAGENARCANA-009)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VisualizationComposer from '../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import { JSDOM } from 'jsdom';

// Mock RenderContext
jest.mock('../../../src/domUI/anatomy-renderer/types/RenderContext.js', () => {
  return jest.fn().mockImplementation(() => ({
    updateTheme: jest.fn(),
    updatePerformance: jest.fn(),
    updateViewport: jest.fn(),
  }));
});

// Mock DomUtils
jest.mock('../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    textToHtml: jest.fn((text) => text),
    escapeHtml: jest.fn((text) => text),
  },
}));

describe('VisualizationComposer Performance Validation', () => {
  let mockLogger;
  let mockEntityManager;
  let mockDocumentContext;
  let mockLayoutEngine;
  let mockSvgRenderer;
  let mockInteractionController;
  let mockViewportManager;
  let visualizationComposer;
  let dom;
  let mockContainer;
  let mockSvgElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><div id="anatomy-container"></div>');
    const document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockDocumentContext = {
      document: {
        getElementById: jest.fn(),
        createElement: jest.fn(),
        createElementNS: jest.fn(),
      },
    };

    mockLayoutEngine = {
      calculateLayout: jest.fn(),
      setStrategy: jest.fn(),
      getCurrentStrategyName: jest.fn().mockReturnValue('radial'),
    };

    mockSvgElement = {
      style: {},
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
    };

    mockSvgRenderer = {
      createSVG: jest.fn(),
      clearSVG: jest.fn(),
      renderEdges: jest.fn(),
      renderNodes: jest.fn(),
      addDebugInfo: jest.fn(),
      getSVGElement: jest.fn().mockReturnValue(mockSvgElement),
      updateViewBox: jest.fn(),
      applyTheme: jest.fn(),
      showTooltip: jest.fn(),
      hideTooltip: jest.fn(),
    };

    mockInteractionController = {
      registerHandler: jest.fn(),
      attachToElement: jest.fn(),
      detachFromElement: jest.fn(),
    };

    mockViewportManager = {
      reset: jest.fn(),
      subscribe: jest.fn(),
      pan: jest.fn(),
      zoom: jest.fn(),
    };

    mockContainer = {
      appendChild: jest.fn(),
      innerHTML: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    };

    visualizationComposer = new VisualizationComposer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: mockDocumentContext,
      layoutEngine: mockLayoutEngine,
      svgRenderer: mockSvgRenderer,
      interactionController: mockInteractionController,
      viewportManager: mockViewportManager,
    });

    visualizationComposer.initialize(mockContainer);
  });

  /**
   * Creates a mock entity with optional parent relationship
   *
   * @param {string} id - Entity ID
   * @param {string|null} parentId - Parent entity ID
   * @param {string} name - Entity name
   * @returns {object} Mock entity
   */
  const createMockEntity = (id, parentId, name) => ({
    getComponentData: jest.fn((type) => {
      if (type === 'core:name') return { text: name };
      if (type === 'anatomy:part') return { subType: 'limb' };
      if (type === 'anatomy:joint' && parentId)
        return { parentId, socketId: 'socket' };
      return null;
    }),
    getAllComponents: jest.fn().mockReturnValue({}),
  });

  /**
   * Generates a linear tree structure (chain) with n entities
   * Root -> Child1 -> Child2 -> ... -> ChildN-1
   *
   * @param {number} count - Total number of entities
   * @returns {object} Body data and entity map
   */
  const generateLinearTree = (count) => {
    const entities = {};
    const parts = {};

    // Create root
    const rootId = 'entity-0';
    entities[rootId] = createMockEntity(rootId, null, 'Root');

    // Create chain of children
    for (let i = 1; i < count; i++) {
      const entityId = `entity-${i}`;
      const parentId = `entity-${i - 1}`;
      entities[entityId] = createMockEntity(entityId, parentId, `Part-${i}`);
      parts[`part-${i}`] = entityId;
    }

    return {
      bodyData: { root: rootId, parts },
      entities,
    };
  };

  /**
   * Generates a wide tree structure (star topology)
   * Root with n-1 direct children
   *
   * @param {number} count - Total number of entities
   * @returns {object} Body data and entity map
   */
  const generateWideTree = (count) => {
    const entities = {};
    const parts = {};

    // Create root
    const rootId = 'entity-0';
    entities[rootId] = createMockEntity(rootId, null, 'Root');

    // Create all children pointing to root
    for (let i = 1; i < count; i++) {
      const entityId = `entity-${i}`;
      entities[entityId] = createMockEntity(entityId, rootId, `Part-${i}`);
      parts[`part-${i}`] = entityId;
    }

    return {
      bodyData: { root: rootId, parts },
      entities,
    };
  };

  /**
   * Robust measurement with warm-up runs and multi-iteration median calculation.
   * Reduces flakiness by eliminating JIT compilation noise and using statistical
   * aggregation to filter out outliers.
   *
   * @param {object} bodyData - Body data structure
   * @param {object} entities - Entity map
   * @param {object} options - Measurement options
   * @param {number} options.warmupRuns - Number of warm-up runs to discard
   * @param {number} options.iterations - Number of measured iterations
   * @returns {Promise<number>} Median execution time in milliseconds
   */
  const measureBuildTimeRobust = async (bodyData, entities, options = {}) => {
    const { warmupRuns = 2, iterations = 5 } = options;

    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      Promise.resolve(entities[id])
    );

    // Warm-up runs (discarded) - allows JIT to optimize
    for (let i = 0; i < warmupRuns; i++) {
      await visualizationComposer.buildGraphData(bodyData);
      visualizationComposer.clear();
    }

    // Measured runs
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await visualizationComposer.buildGraphData(bodyData);
      times.push(performance.now() - start);
      visualizationComposer.clear();
    }

    // Return median (more robust than mean against outliers)
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  };

  describe('Linear Scaling Verification', () => {
    it('should scale linearly with entity count (not quadratically)', async () => {
      // Use larger counts for clearer signal-to-noise ratio
      // Small counts (10-100) have too much measurement noise at millisecond scale
      const counts = [100, 500, 1000];
      const times = [];

      for (const count of counts) {
        const { bodyData, entities } = generateLinearTree(count);
        const time = await measureBuildTimeRobust(bodyData, entities, {
          warmupRuns: 2,
          iterations: 5,
        });
        times.push({ count, time });
      }

      // Calculate scaling ratio using larger difference (1000 vs 500)
      // For O(n) algorithm: time1000/time500 should be ~2
      // For O(n²) algorithm: time1000/time500 would be ~4

      const time500 = times[1].time;
      const time1000 = times[2].time;
      const scalingRatio = time1000 / time500;

      // For O(n): ratio should be ~2.0
      // For O(n²): ratio would be ~4.0
      // Allow tolerance up to 4.0 (100% above linear) for system variance
      expect(scalingRatio).toBeLessThan(4.0);

      // Also verify it's not suspiciously sub-linear (would indicate broken test)
      expect(scalingRatio).toBeGreaterThan(1.5);

      // Log performance metrics for debugging
      mockLogger.debug('Performance metrics:', {
        times: times.map((t) => `${t.count}: ${t.time.toFixed(2)}ms`),
        scalingRatio: scalingRatio.toFixed(2),
      });
    });

    it('should handle 500-part anatomy within reasonable time', async () => {
      const { bodyData, entities } = generateLinearTree(500);

      const time = await measureBuildTimeRobust(bodyData, entities, {
        warmupRuns: 2,
        iterations: 3,
      });

      // Should complete in under 1000ms even on slow machines
      // The actual time should be much lower with O(n) algorithm
      expect(time).toBeLessThan(1000);
    });
  });

  describe('Wide Tree Performance', () => {
    it('should handle wide trees (many children per node) efficiently', async () => {
      // Star topology - root with 499 children (larger for better measurement)
      const { bodyData, entities } = generateWideTree(500);

      const time = await measureBuildTimeRobust(bodyData, entities, {
        warmupRuns: 2,
        iterations: 3,
      });

      // With O(1) child lookup, wide trees should be as fast as linear trees
      // Allow up to 500ms for 500 entities on slow machines
      expect(time).toBeLessThan(500);
    });
  });

  describe('Index Building Overhead', () => {
    it('should build parent-child index without excessive overhead', async () => {
      // Use 500 entities for clearer O(n) vs O(n²) distinction
      const { bodyData, entities } = generateLinearTree(500);

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(entities[id])
      );

      await visualizationComposer.buildGraphData(bodyData);

      // Verify index was built (logged as debug message)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built parent-child index')
      );

      // The number of getEntityInstance calls should be reasonable
      // With index approach: O(n) for index building + O(n) for BFS = ~2n calls
      // Without optimization: O(n²) calls would be 500*500 = 250,000
      const callCount = mockEntityManager.getEntityInstance.mock.calls.length;

      // Should be roughly 2n (index phase + BFS phase), so ~1000 calls
      // Allow some overhead but should be much less than n² = 250,000
      expect(callCount).toBeLessThan(2000);
    });
  });
});
