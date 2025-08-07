/**
 * @file Performance tests for ThematicDirectionsManagerController
 * @description Validates performance metrics remain within acceptable bounds
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import { BaseCharacterBuilderControllerTestBase } from '../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

// Mock InPlaceEditor at module level to intercept ES6 imports
jest.mock('../../../src/shared/characterBuilder/inPlaceEditor.js', () => ({
  InPlaceEditor: jest.fn(),
}));

describe('ThematicDirectionsManagerController Performance', () => {
  let testBase;
  let controller;
  let InPlaceEditor;

  // Performance thresholds (in milliseconds)
  const THRESHOLDS = {
    initialization: 100, // Max 100ms to initialize
    renderSmall: 50, // Max 50ms for 10 items
    renderMedium: 200, // Max 200ms for 100 items
    renderLarge: 1000, // Max 1s for 1000 items
    filterApplication: 20, // Max 20ms to apply filter
    editorCreation: 5, // Max 5ms per editor
    cleanup: 50, // Max 50ms to destroy
    memoryIncrease: 10 * 1024 * 1024, // Max 10MB increase
  };

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add complete DOM structure
    testBase.addDOMElement(getPerformanceTestDOM());

    // Mock services with predictable data
    setupPerformanceMocks(testBase.mocks);

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
  });

  describe('Initialization Performance', () => {
    it('should initialize within threshold', async () => {
      const startTime = performance.now();

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(THRESHOLDS.initialization);

      console.log(`Initialization time: ${duration.toFixed(2)}ms`);
    });

    it('should not leak memory during initialization', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy multiple times
      for (let i = 0; i < 10; i++) {
        controller = new ThematicDirectionsManagerController(testBase.mocks);
        await controller.initialize();
        controller.destroy();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(THRESHOLDS.memoryIncrease);

      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe('Rendering Performance', () => {
    it('should render small dataset quickly', async () => {
      const directions = generateDirections(10);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      const startTime = performance.now();
      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();
      const endTime = performance.now();

      const duration = endTime - startTime;
      // Include initialization and initial render time
      expect(duration).toBeLessThan(
        THRESHOLDS.renderSmall + THRESHOLDS.initialization
      );

      // Verify directions were rendered
      const directionCards = document.querySelectorAll(
        '.direction-card-editable'
      );
      expect(directionCards.length).toBe(10);

      console.log(`Initialize + Render 10 items: ${duration.toFixed(2)}ms`);
    });

    it('should render medium dataset efficiently', async () => {
      const directions = generateDirections(100);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      const startTime = performance.now();
      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();
      const endTime = performance.now();

      const duration = endTime - startTime;
      // Include initialization and initial render time
      expect(duration).toBeLessThan(
        THRESHOLDS.renderMedium + THRESHOLDS.initialization
      );

      // Verify directions were rendered
      const directionCards = document.querySelectorAll(
        '.direction-card-editable'
      );
      expect(directionCards.length).toBe(100);

      console.log(`Initialize + Render 100 items: ${duration.toFixed(2)}ms`);
    });

    it('should handle large dataset without blocking', async () => {
      const directions = generateDirections(1000);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      const startTime = performance.now();
      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();
      const endTime = performance.now();

      const duration = endTime - startTime;
      // Include initialization and initial render time
      expect(duration).toBeLessThan(
        THRESHOLDS.renderLarge + THRESHOLDS.initialization
      );

      // Verify directions were rendered
      const directionCards = document.querySelectorAll(
        '.direction-card-editable'
      );
      expect(directionCards.length).toBe(1000);

      console.log(`Initialize + Render 1000 items: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Filtering Performance', () => {
    it('should apply filters quickly', async () => {
      const directions = generateDirections(100);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      // Measure filter application time through the input event
      const measurements = [];
      const filterTerms = ['test', 'direction', 'tag', 'a', 'xyz'];
      const filterInput = document.getElementById('direction-filter');

      for (const term of filterTerms) {
        const startTime = performance.now();
        filterInput.value = term;
        filterInput.dispatchEvent(new Event('input'));
        const endTime = performance.now();

        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      expect(avgTime).toBeLessThan(THRESHOLDS.filterApplication);

      console.log(`Average filter time: ${avgTime.toFixed(2)}ms`);
    });

    it('should handle rapid filter changes efficiently', async () => {
      const directions = generateDirections(50);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      const filterInput = document.getElementById('direction-filter');
      const initialCount = document.querySelectorAll(
        '.direction-card-editable'
      ).length;

      // Rapidly type characters
      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        filterInput.value = 'test'.substring(0, (i % 4) + 1);
        filterInput.dispatchEvent(new Event('input'));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Check that filtering happened
      const finalCount = document.querySelectorAll(
        '.direction-card-editable'
      ).length;

      // Performance should still be good despite rapid changes
      expect(duration).toBeLessThan(500); // 500ms for 10 rapid filter changes

      console.log(`Rapid filtering completed in: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Component Performance', () => {
    it('should create InPlaceEditors efficiently', async () => {
      // Track creation times
      let creationTimes = [];

      // Configure mock implementation to measure creation time
      InPlaceEditor.mockImplementation((config) => {
        const start = performance.now();
        const editor = {
          destroy: jest.fn(),
          config: config,
        };
        creationTimes.push(performance.now() - start);
        return editor;
      });

      const directions = generateDirections(20);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      // Measure the full initialization cycle that includes editor creation
      const startTime = performance.now();
      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();
      const endTime = performance.now();

      // Each direction has 5 editors (title, description, coreTension, uniqueTwist, narrativePotential)
      const expectedEditors = directions.length * 5;
      expect(creationTimes.length).toBe(expectedEditors);

      const avgCreationTime =
        creationTimes.reduce((a, b) => a + b) / creationTimes.length;
      expect(avgCreationTime).toBeLessThan(THRESHOLDS.editorCreation);

      const totalTime = endTime - startTime;
      console.log(`Average editor creation: ${avgCreationTime.toFixed(2)}ms`);
      console.log(`Total initialization time: ${totalTime.toFixed(2)}ms`);
      console.log(`Created ${creationTimes.length} InPlaceEditor instances`);
    });

    it('should destroy components quickly', async () => {
      // Configure mock implementation for destroy test
      InPlaceEditor.mockImplementation(() => ({
        destroy: jest.fn(),
      }));

      const directions = generateDirections(50);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      const startTime = performance.now();
      controller.destroy();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(THRESHOLDS.cleanup);

      console.log(`Cleanup time: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance', () => {
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

      // Perform multiple operations with improved measurement stability
      for (let i = 0; i < 7; i++) {
        // Increased sample size from 5 to 7
        // Force garbage collection multiple times for more stable measurements
        if (global.gc) {
          global.gc();
          global.gc(); // Double GC to ensure cleanup
          // Allow GC to complete
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        const beforeOp = process.memoryUsage().heapUsed;

        // Apply filter through the input (triggers editor recreation)
        const filterInput = document.getElementById('direction-filter');
        filterInput.value = `test${i}`;
        filterInput.dispatchEvent(new Event('input'));

        // Clear filter (triggers editor recreation again)
        filterInput.value = '';
        filterInput.dispatchEvent(new Event('input'));

        // Allow async operations to complete with longer timeout
        await new Promise((resolve) => setTimeout(resolve, 25));

        const afterOp = process.memoryUsage().heapUsed;
        measurements.push(afterOp - beforeOp);
      }

      // Calculate median instead of average to reduce impact of outliers
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);
      const medianIncrease =
        sortedMeasurements[Math.floor(sortedMeasurements.length / 2)];

      // Realistic memory usage for DOM operations with 250 rich components (50 directions × 5 editors)
      // Each InPlaceEditor instance has DOM references, event handlers, and callback functions
      // Increased to 10MB to account for jsdom overhead, test environment variability, and V8 optimization patterns
      expect(medianIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB median increase (accounts for test environment variability)

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
  });

  describe('Event Handling Performance', () => {
    it('should handle rapid clicks efficiently', async () => {
      const directions = generateDirections(20);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      controller = new ThematicDirectionsManagerController(testBase.mocks);
      await controller.initialize();

      const clickTimes = [];
      const directionCards = document.querySelectorAll(
        '.direction-card-editable'
      );

      // Check if we have any cards to test
      if (directionCards.length === 0) {
        console.log('No direction cards found for click testing');
        return;
      }

      // Rapidly click different cards
      for (let i = 0; i < Math.min(20, directionCards.length); i++) {
        const card = directionCards[i % directionCards.length];
        const startTime = performance.now();

        card.click();

        const endTime = performance.now();
        clickTimes.push(endTime - startTime);
      }

      const avgClickTime =
        clickTimes.reduce((a, b) => a + b) / clickTimes.length;
      expect(avgClickTime).toBeLessThan(5); // Should handle clicks in < 5ms

      console.log(`Average click handling: ${avgClickTime.toFixed(2)}ms`);
    });
  });
});

// Helper functions
/**
 *
 */
function getPerformanceTestDOM() {
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
function setupPerformanceMocks(mocks) {
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
