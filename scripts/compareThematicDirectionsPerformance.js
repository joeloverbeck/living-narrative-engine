#!/usr/bin/env node

/**
 * @file Performance comparison script for ThematicDirectionsManagerController migration
 * @description Compares performance metrics between original and migrated versions
 */

import { performance } from 'perf_hooks';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import controller - assuming the current implementation is the migrated one
// For actual comparison, you'd need both original and migrated versions
import { ThematicDirectionsManagerController } from '../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

/**
 *
 */
async function main() {
  console.log('ThematicDirectionsManagerController Performance Comparison\n');
  console.log('═'.repeat(60));

  // Setup DOM environment
  const dom = new JSDOM(await getHTMLTemplate());
  global.window = dom.window;
  global.document = dom.window.document;
  global.InPlaceEditor = createMockInPlaceEditor();

  // Setup mocks
  const mocks = createMocks();

  // Test scenarios
  const scenarios = [
    { name: 'Small Dataset (10 items)', count: 10 },
    { name: 'Medium Dataset (100 items)', count: 100 },
    { name: 'Large Dataset (1000 items)', count: 1000 },
  ];

  const results = {
    current: {},
    baseline: getBaselineMetrics(), // Pre-recorded baseline metrics
  };

  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    console.log('─'.repeat(40));

    // Test current controller
    results.current[scenario.name] = await testController(
      ThematicDirectionsManagerController,
      mocks,
      scenario.count,
      'Current'
    );

    // Compare against baseline
    compareResults(
      results.baseline[scenario.name],
      results.current[scenario.name],
      scenario.name
    );
  }

  // Generate report
  await generateReport(results);

  dom.window.close();
  process.exit(0);
}

/**
 *
 * @param ControllerClass
 * @param mocks
 * @param itemCount
 * @param label
 */
async function testController(ControllerClass, mocks, itemCount, label) {
  const metrics = {};

  // Update mocks for item count
  mocks.characterBuilderService.getAllThematicDirectionsWithConcepts = () =>
    Promise.resolve(generateDirections(itemCount));

  // Measure initialization
  const initStart = performance.now();
  const controller = new ControllerClass(mocks);
  await controller.initialize();
  metrics.initialization = performance.now() - initStart;

  // Measure render
  const renderStart = performance.now();
  if (controller._displayDirections) {
    controller._displayDirections();
  }
  metrics.render = performance.now() - renderStart;

  // Measure filtering
  const filterStart = performance.now();
  if (controller._handleFilterChange) {
    controller._handleFilterChange('test');
  }
  metrics.filter = performance.now() - filterStart;

  // Measure memory usage
  metrics.memory = process.memoryUsage().heapUsed;

  // Measure cleanup
  const cleanupStart = performance.now();
  controller.destroy();
  metrics.cleanup = performance.now() - cleanupStart;

  // Log results
  console.log(`\n${label} Controller:`);
  console.log(`  Initialization: ${metrics.initialization.toFixed(2)}ms`);
  console.log(`  Render: ${metrics.render.toFixed(2)}ms`);
  console.log(`  Filter: ${metrics.filter.toFixed(2)}ms`);
  console.log(`  Memory: ${(metrics.memory / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Cleanup: ${metrics.cleanup.toFixed(2)}ms`);

  return metrics;
}

/**
 *
 * @param baseline
 * @param current
 * @param scenarioName
 */
function compareResults(baseline, current, scenarioName) {
  console.log('\nPerformance Comparison:');
  console.log('─'.repeat(40));

  const metrics = ['initialization', 'render', 'filter', 'cleanup'];
  let allPassed = true;

  for (const metric of metrics) {
    const baselineValue = baseline[metric];
    const currentValue = current[metric];
    const diff = currentValue - baselineValue;
    const percent = ((diff / baselineValue) * 100).toFixed(1);
    const status = Math.abs(percent) <= 5 ? '✅' : '❌';

    if (Math.abs(percent) > 5) {
      allPassed = false;
    }

    console.log(
      `  ${metric.padEnd(15)}: ${percent.padStart(6)}% ${
        parseFloat(percent) > 0 ? 'slower' : 'faster'
      } ${status}`
    );
  }

  // Memory comparison
  const memDiff = current.memory - baseline.memory;
  const memPercent = ((memDiff / baseline.memory) * 100).toFixed(1);
  const memStatus =
    memDiff <= 0 ? '✅' : Math.abs(memPercent) <= 5 ? '✅' : '❌';

  console.log(
    `  Memory         : ${memPercent.padStart(6)}% ${
      memDiff > 0 ? 'more' : 'less'
    } ${memStatus}`
  );

  if (!allPassed) {
    console.log('\n⚠️  Performance regression detected!');
  } else {
    console.log('\n✅ All metrics within acceptable thresholds');
  }
}

/**
 *
 * @param results
 */
async function generateReport(results) {
  const reportPath = path.join(process.cwd(), 'performance-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    results: results,
    summary: generateSummary(results),
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📊 Performance report saved to: ${reportPath}`);
}

/**
 *
 * @param results
 */
function generateSummary(results) {
  const summary = {
    passed: true,
    details: [],
  };

  for (const scenario of Object.keys(results.baseline)) {
    const baseline = results.baseline[scenario];
    const current = results.current[scenario];

    const scenarioSummary = {
      scenario: scenario,
      metrics: {},
      passed: true,
    };

    const metrics = ['initialization', 'render', 'filter', 'cleanup'];

    for (const metric of metrics) {
      const percent =
        ((current[metric] - baseline[metric]) / baseline[metric]) * 100;
      scenarioSummary.metrics[metric] = {
        baseline: baseline[metric],
        current: current[metric],
        difference: percent.toFixed(1) + '%',
        passed: Math.abs(percent) <= 5,
      };

      if (Math.abs(percent) > 5) {
        scenarioSummary.passed = false;
        summary.passed = false;
      }
    }

    summary.details.push(scenarioSummary);
  }

  return summary;
}

// Mock creation functions
/**
 *
 */
function createMocks() {
  return {
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    eventBus: {
      subscribe: () => () => {},
      unsubscribe: () => {},
      dispatch: () => {},
    },
    characterBuilderService: {
      initialize: () => Promise.resolve(),
      getAllCharacterConcepts: () => Promise.resolve([]),
      getOrphanedThematicDirections: () => Promise.resolve([]),
      getAllThematicDirectionsWithConcepts: () => Promise.resolve([]),
      updateThematicDirection: () => Promise.resolve({ id: 'updated' }),
      deleteThematicDirection: () => Promise.resolve(true),
    },
    schemaValidator: {
      validateAgainstSchema: () => ({ isValid: true, errors: [] }),
      hasSchema: () => true,
    },
    uiStateManager: {
      showEmpty: () => {},
      showLoading: () => {},
      showResults: () => {},
      showError: () => {},
      hideAll: () => {},
      getCurrentState: () => 'empty',
    },
  };
}

/**
 *
 */
function createMockInPlaceEditor() {
  return class MockInPlaceEditor {
    constructor(config) {
      this.config = config;
    }
    destroy() {}
  };
}

/**
 *
 */
async function getHTMLTemplate() {
  return `<!DOCTYPE html>
  <html>
  <body>
    <div id="directions-container">
      <div id="empty-state" class="cb-empty-state"></div>
      <div id="loading-state" class="cb-loading-state"></div>
      <div id="error-state" class="cb-error-state">
        <p id="error-message-text"></p>
      </div>
      <div id="results-state" class="cb-state-container">
        <input id="direction-filter" type="text" />
        <select id="concept-filter"></select>
        <button id="filter-clear">Clear</button>
        <div id="directions-list"></div>
      </div>
    </div>
    
    <div id="modal-overlay"></div>
    <div id="confirmation-modal">
      <h2 id="modal-title"></h2>
      <p id="modal-message"></p>
      <button id="modal-confirm-btn">Confirm</button>
      <button id="modal-cancel-btn">Cancel</button>
    </div>
  </body>
  </html>`;
}

/**
 *
 * @param count
 */
function generateDirections(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `dir-${i}`,
    name: `Direction ${i}`,
    description: `This is the description for direction ${i}. It contains some text to make it realistic.`,
    tags: [`tag${i % 10}`, `category${i % 5}`, `type${i % 3}`],
    concepts:
      i % 3 === 0 ? [{ id: `c${i % 5}`, name: `Concept ${i % 5}` }] : [],
    orphaned: i % 10 === 0,
  }));
}

// Baseline metrics (these would be from the original implementation)
// For demonstration, using reasonable values
/**
 *
 */
function getBaselineMetrics() {
  return {
    'Small Dataset (10 items)': {
      initialization: 50,
      render: 25,
      filter: 5,
      cleanup: 10,
      memory: 10 * 1024 * 1024, // 10MB
    },
    'Medium Dataset (100 items)': {
      initialization: 75,
      render: 100,
      filter: 10,
      cleanup: 20,
      memory: 20 * 1024 * 1024, // 20MB
    },
    'Large Dataset (1000 items)': {
      initialization: 100,
      render: 500,
      filter: 15,
      cleanup: 30,
      memory: 50 * 1024 * 1024, // 50MB
    },
  };
}

// Run the comparison
main().catch((error) => {
  console.error('Error running performance comparison:', error);
  process.exit(1);
});
