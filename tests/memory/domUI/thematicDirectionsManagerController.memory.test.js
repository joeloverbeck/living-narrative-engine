/**
 * @file Memory tests for ThematicDirectionsManagerController
 * @description Validates memory usage and leak detection
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

// Mock InPlaceEditor at module level to intercept ES6 imports
jest.mock('../../../src/shared/characterBuilder/inPlaceEditor.js', () => ({
  InPlaceEditor: jest.fn(),
}));

describe('ThematicDirectionsManagerController - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let testBase;
  let controller;
  let InPlaceEditor;

  // Memory thresholds
  const MEMORY_THRESHOLDS = {
    initialization: 15 * 1024 * 1024, // Max 15MB increase for initialization
    operations: 20 * 1024 * 1024, // Max 20MB increase for operations (accounts for jsdom overhead)
  };

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();

    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add complete DOM structure
    testBase.addDOMElement(getMemoryTestDOM());

    // Mock services with predictable data
    setupMemoryMocks(testBase.mocks);

    // Get the mocked InPlaceEditor for this test suite
    const module = await import(
      '../../../src/shared/characterBuilder/inPlaceEditor.js'
    );
    InPlaceEditor = module.InPlaceEditor;

    // Set up default mock implementation
    InPlaceEditor.mockImplementation(() => ({
      destroy: jest.fn(),
    }));
  });

  afterEach(async () => {
    if (controller && !controller.isDestroyed) {
      controller.destroy();
    }
    await testBase.cleanup();

    // Clear mock calls for next test
    if (InPlaceEditor) {
      InPlaceEditor.mockClear();
    }

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Initialization Memory', () => {
    it('should not leak memory during initialization', async () => {
      // Establish baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create and destroy multiple times
      const iterations = global.memoryTestUtils.isCI() ? 8 : 10;

      for (let i = 0; i < iterations; i++) {
        controller = new ThematicDirectionsManagerController(testBase.mocks);
        await controller.initialize();
        controller.destroy();
        controller = null;
      }

      // Force cleanup and measure
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const memoryIncrease = Math.max(0, finalMemory - baselineMemory);

      expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.initialization);

      console.log(
        `Memory leak test - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, ` +
          `Iterations: ${iterations}`
      );
    });
  });

  describe('Operation Memory', () => {
    it('should not leak memory during operations', async () => {
      // Configure mock for memory test
      InPlaceEditor.mockImplementation(() => ({
        destroy: jest.fn(),
      }));

      const directions = generateDirections(50);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      const measurements = [];

      // Warmup iterations to stabilize V8 optimizations
      for (let warmup = 0; warmup < 2; warmup++) {
        const filterInput = document.getElementById('direction-filter');
        filterInput.value = 'warmup';
        filterInput.dispatchEvent(new Event('input'));
        filterInput.value = '';
        filterInput.dispatchEvent(new Event('input'));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Establish baseline after warmup
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Perform multiple operations with improved measurement stability
      const operationCount = global.memoryTestUtils.isCI() ? 5 : 7;

      for (let i = 0; i < operationCount; i++) {
        // Force garbage collection for stable measurements
        await global.memoryTestUtils.forceGCAndWait();

        const beforeOp = await global.memoryTestUtils.getStableMemoryUsage();

        // Apply filter through the input (triggers editor recreation)
        const filterInput = document.getElementById('direction-filter');
        filterInput.value = `test${i}`;
        filterInput.dispatchEvent(new Event('input'));

        // Clear filter (triggers editor recreation again)
        filterInput.value = '';
        filterInput.dispatchEvent(new Event('input'));

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        const afterOp = await global.memoryTestUtils.getStableMemoryUsage();
        measurements.push(afterOp - beforeOp);
      }

      // Calculate median instead of average to reduce impact of outliers
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);
      const medianIncrease =
        sortedMeasurements[Math.floor(sortedMeasurements.length / 2)];

      // Final cleanup and measurement
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();
      const totalIncrease = Math.max(0, finalMemory - baselineMemory);

      // Memory assertions
      // Each InPlaceEditor instance has DOM references, event handlers, and callback functions
      // 50 directions × 5 editors = 250 rich components
      expect(medianIncrease).toBeLessThan(MEMORY_THRESHOLDS.operations);
      expect(totalIncrease).toBeLessThan(MEMORY_THRESHOLDS.operations * 2);

      console.log(
        `Memory operations - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Total Increase: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Memory measurements (KB): [${measurements.map((m) => (m / 1024).toFixed(0)).join(', ')}]`
      );
      console.log(
        `Median memory increase per operation: ${(medianIncrease / 1024).toFixed(2)}KB`
      );
      console.log(
        `Total InPlaceEditor mock calls: ${InPlaceEditor.mock.calls.length}`
      );
    });

    it('should efficiently manage memory with large datasets', async () => {
      const largeDirectionsCount = global.memoryTestUtils.isCI() ? 500 : 1000;

      // Establish baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create large dataset
      const directions = generateDirections(largeDirectionsCount);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      // Initialize with large dataset
      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clean up
      controller.destroy();
      controller = null;

      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryRetained = Math.max(0, finalMemory - baselineMemory);
      const memoryPerDirection = memoryGrowth / largeDirectionsCount;

      // Assertions (adjusted for realistic jsdom + controller overhead)
      // Note: jsdom doesn't fully release DOM memory in test environment
      const maxMemoryPerDirection = global.memoryTestUtils.isCI()
        ? 150000
        : 120000; // bytes per direction (includes DOM and editors)
      const maxRetainedMB = global.memoryTestUtils.isCI() ? 120 : 120; // jsdom retains significant DOM memory

      expect(memoryPerDirection).toBeLessThan(maxMemoryPerDirection);
      expect(memoryRetained).toBeLessThan(maxRetainedMB * 1024 * 1024);

      console.log(
        `Large dataset memory - Directions: ${largeDirectionsCount}, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Direction: ${memoryPerDirection.toFixed(0)} bytes, ` +
          `Retained: ${(memoryRetained / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });
});

// Helper functions
/**
 *
 */
function getMemoryTestDOM() {
  return `
    <div id="directions-container">
      <div id="empty-state" class="cb-empty-state"></div>
      <div id="loading-state" class="cb-loading-state"></div>
      <div id="error-state" class="cb-error-state">
        <p id="error-message-text"></p>
      </div>
      <div id="results-state" class="cb-state-container">
        <input id="direction-filter" type="text" />
        <select id="concept-selector"></select>
        <button id="filter-clear">Clear</button>
        <div id="directions-results"></div>
      </div>
    </div>
    
    <div id="concept-display-container" style="display: none;">
      <div id="concept-display-content"></div>
    </div>
    
    <div id="modal-overlay"></div>
    <div id="confirmation-modal">
      <h2 id="modal-title"></h2>
      <p id="modal-message"></p>
      <button id="modal-confirm-btn">Confirm</button>
      <button id="modal-cancel-btn">Cancel</button>
    </div>
    
    <div id="total-directions">0</div>
    <div id="orphaned-count">0</div>
    <button id="cleanup-orphans-btn">Cleanup</button>
    <button id="refresh-btn">Refresh</button>
    <button id="back-to-menu-btn">Back</button>
    <button id="retry-btn">Retry</button>
  `;
}

/**
 *
 * @param mocks
 */
function setupMemoryMocks(mocks) {
  mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);
  mocks.characterBuilderService.getOrphanedThematicDirections.mockResolvedValue(
    []
  );
}

/**
 *
 * @param count
 */
function generateDirections(count) {
  return Array.from({ length: count }, (_, i) => ({
    direction: {
      id: `dir-${i}`,
      title: `Direction ${i}`,
      description: `This is the description for direction ${i}. It contains some text to make it realistic.`,
      coreTension: `The core tension for direction ${i} exploring fundamental conflicts.`,
      uniqueTwist: `A unique twist that makes direction ${i} special and interesting.`,
      narrativePotential: `The narrative potential of direction ${i} provides rich storytelling opportunities.`,
    },
    concept:
      i % 10 !== 0
        ? {
            id: `concept-${i % 5}`,
            concept: `Character concept ${i % 5} with detailed background and motivation that shapes the narrative direction.`,
            status: 'active',
            createdAt: new Date().toISOString(),
            thematicDirections: [`dir-${i}`],
          }
        : null,
  }));
}
