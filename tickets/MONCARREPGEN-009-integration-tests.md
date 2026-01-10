# MONCARREPGEN-009: Integration Tests

## Summary

Create integration tests that verify the complete flow: simulation → report generation → modal display → clipboard copy.

## Priority: Medium | Effort: Medium

## Rationale

Integration tests validate:
- All components work together correctly
- Data flows from simulator through report generator to modal
- Flag detection produces expected output for real simulation data
- Clipboard functionality works in realistic scenario
- No regressions when components are modified

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class
- **MONCARREPGEN-002** - DI registration
- **MONCARREPGEN-003** - HTML structure
- **MONCARREPGEN-004** - CSS styling
- **MONCARREPGEN-005** - MonteCarloReportModal class
- **MONCARREPGEN-006** - Controller integration

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** modify unit tests - those are MONCARREPGEN-007 and MONCARREPGEN-008
- **DO NOT** test MonteCarloSimulator internals - use its output
- **DO NOT** test FailureExplainer internals - use its output
- **DO NOT** add new features to the report generator

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Integration tests for Monte Carlo Report generation flow
 * @see specs/monte-carlo-report-generator.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock clipboard before imports
jest.mock('../../../src/domUI/helpers/clipboardUtils.js', () => ({
  copyToClipboard: jest.fn(),
}));

import { copyToClipboard } from '../../../src/domUI/helpers/clipboardUtils.js';

describe('Monte Carlo Report Integration', () => {
  let container;
  let controller;
  let reportGenerator;
  let reportModal;

  beforeEach(async () => {
    // Setup DOM with full structure
    document.body.innerHTML = `
      <div id="expression-diagnostics">
        <div id="mc-results" hidden>
          <div id="mc-summary"></div>
          <div id="mc-trigger-rate"></div>
          <div id="mc-blockers"></div>
          <div class="mc-results-actions">
            <button id="generate-report-btn">Generate Report</button>
          </div>
        </div>
        <div id="mc-report-modal" class="modal-overlay" style="display: none;">
          <div class="modal-content modal-content--large">
            <button id="mc-report-close-btn">×</button>
            <pre id="mc-report-content" class="mc-report-content"></pre>
            <div id="mc-report-status" class="status-message-area"></div>
            <button id="mc-report-copy-btn">Copy to Clipboard</button>
          </div>
        </div>
      </div>
    `;

    // Setup DI container and resolve dependencies
    // ... container setup code ...

    copyToClipboard.mockReset();
    copyToClipboard.mockResolvedValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    container = null;
    controller = null;
  });

  // Test sections below...
});
```

### Test Categories

#### 1. Full Flow Tests
```javascript
describe('Full Report Generation Flow', () => {
  it('should generate report from simulation results', async () => {
    // Arrange: Setup simulation result and blockers
    const simulationResult = {
      triggerRate: 0.05,
      triggerCount: 500,
      sampleCount: 10000,
      confidenceInterval: { low: 0.04, high: 0.06 },
      distribution: 'uniform',
      clauseFailures: [],
    };

    const blockers = [
      {
        clauseDescription: 'emotions.joy >= 0.5',
        failureRate: 0.75,
        averageViolation: 0.3,
        rank: 1,
        severity: 'high',
        advancedAnalysis: {
          percentileAnalysis: { status: 'normal', insight: 'Normal distribution' },
          nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'Some near misses' },
          ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'Reachable' },
          lastMileAnalysis: { status: 'moderate', isDecisive: false, insight: 'Not decisive' },
          recommendation: { action: 'tune_threshold', priority: 'medium', message: 'Adjust threshold' },
        },
        hierarchicalBreakdown: {
          variablePath: 'emotions.joy',
          comparisonOperator: '>=',
          thresholdValue: 0.5,
          violationP50: 0.2,
          violationP90: 0.4,
          nearMissRate: 0.08,
          nearMissEpsilon: 0.05,
          maxObservedValue: 0.6,
          ceilingGap: -0.1,
          lastMileFailRate: 0.3,
          othersPassedCount: 5000,
          isSingleClause: false,
        },
      },
    ];

    // Act: Display results and trigger report generation
    controller.displayMonteCarloResults(simulationResult, blockers, 'Test summary');
    document.querySelector('#generate-report-btn').click();

    // Assert: Modal opens with report content
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(reportModal.isVisible).toBe(true);
    const content = document.querySelector('#mc-report-content').textContent;

    // Verify report structure
    expect(content).toContain('# Monte Carlo Analysis Report');
    expect(content).toContain('## Executive Summary');
    expect(content).toContain('## Blocker Analysis');
    expect(content).toContain('emotions.joy >= 0.5');
    expect(content).toContain('75'); // failure rate
  });

  it('should copy report content to clipboard', async () => {
    // Arrange: Generate report first
    await generateReportWithBlockers();

    // Act: Click copy button
    document.querySelector('#mc-report-copy-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert: Clipboard called with report content
    expect(copyToClipboard).toHaveBeenCalled();
    const copiedContent = copyToClipboard.mock.calls[0][0];
    expect(copiedContent).toContain('# Monte Carlo Analysis Report');
  });

  it('should show success message after copy', async () => {
    // Arrange
    await generateReportWithBlockers();

    // Act
    document.querySelector('#mc-report-copy-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    const status = document.querySelector('#mc-report-status').textContent;
    expect(status).toContain('Copied');
  });
});
```

#### 2. Flag Detection Integration Tests
```javascript
describe('Flag Detection in Full Flow', () => {
  it('should include [CEILING] flag when ceiling detected', async () => {
    const blockers = [createBlockerWithCeilingDetected()];
    await generateReportWithBlockers(blockers);

    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('[CEILING]');
  });

  it('should include [DECISIVE] flag when single clause', async () => {
    const blockers = [createBlockerWithSingleClause()];
    await generateReportWithBlockers(blockers);

    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('[DECISIVE]');
  });

  it('should include [TUNABLE] flag when near miss rate high', async () => {
    const blockers = [createBlockerWithHighNearMissRate()];
    await generateReportWithBlockers(blockers);

    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('[TUNABLE]');
  });

  it('should include [UPSTREAM] flag when near miss rate low', async () => {
    const blockers = [createBlockerWithLowNearMissRate()];
    await generateReportWithBlockers(blockers);

    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('[UPSTREAM]');
  });

  it('should include multiple flags when conditions overlap', async () => {
    const blockers = [createBlockerWithMultipleFlags()];
    await generateReportWithBlockers(blockers);

    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('[CEILING]');
    expect(content).toContain('[DECISIVE]');
  });
});
```

#### 3. Rarity Category Integration Tests
```javascript
describe('Rarity Categories in Full Flow', () => {
  it('should show "impossible" for 0% trigger rate', async () => {
    await generateReportWithTriggerRate(0);
    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('impossible');
  });

  it('should show "frequent" for >= 2% trigger rate', async () => {
    await generateReportWithTriggerRate(0.05);
    const content = document.querySelector('#mc-report-content').textContent;
    expect(content).toContain('frequent');
  });
});
```

#### 4. Modal Lifecycle Integration Tests
```javascript
describe('Modal Lifecycle in Full Flow', () => {
  it('should clear content when modal is closed', async () => {
    // Arrange: Open modal with report
    await generateReportWithBlockers();
    expect(document.querySelector('#mc-report-content').textContent).not.toBe('');

    // Act: Close modal
    document.querySelector('#mc-report-close-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Assert: Content cleared
    expect(document.querySelector('#mc-report-content').textContent).toBe('');
  });

  it('should close modal on Escape key', async () => {
    await generateReportWithBlockers();
    expect(reportModal.isVisible).toBe(true);

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(reportModal.isVisible).toBe(false);
  });

  it('should focus copy button when modal opens', async () => {
    await generateReportWithBlockers();

    // Allow focus management to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(document.activeElement).toBe(document.querySelector('#mc-report-copy-btn'));
  });
});
```

#### 5. Error Handling Integration Tests
```javascript
describe('Error Handling', () => {
  it('should handle clipboard failure gracefully', async () => {
    copyToClipboard.mockResolvedValue(false);
    await generateReportWithBlockers();

    document.querySelector('#mc-report-copy-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const status = document.querySelector('#mc-report-status').textContent;
    expect(status).toContain('Failed');
  });

  it('should handle clipboard exception gracefully', async () => {
    copyToClipboard.mockRejectedValue(new Error('Clipboard not available'));
    await generateReportWithBlockers();

    document.querySelector('#mc-report-copy-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const status = document.querySelector('#mc-report-status').textContent;
    expect(status).toContain('Failed');
  });

  it('should not open modal when no simulation results', () => {
    // Don't display results first
    document.querySelector('#generate-report-btn').click();

    expect(reportModal.isVisible).toBe(false);
  });
});
```

### Helper Functions

```javascript
/**
 * Generate a report with the given blockers.
 */
async function generateReportWithBlockers(blockers = [createDefaultBlocker()]) {
  const result = createDefaultSimulationResult();
  controller.displayMonteCarloResults(result, blockers, 'Summary');
  document.querySelector('#generate-report-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Generate a report with specific trigger rate.
 */
async function generateReportWithTriggerRate(rate) {
  const result = createDefaultSimulationResult({ triggerRate: rate });
  controller.displayMonteCarloResults(result, [], 'Summary');
  document.querySelector('#generate-report-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function createDefaultSimulationResult(overrides = {}) {
  return {
    triggerRate: 0.15,
    triggerCount: 1500,
    sampleCount: 10000,
    confidenceInterval: { low: 0.14, high: 0.16 },
    distribution: 'uniform',
    clauseFailures: [],
    ...overrides,
  };
}

function createDefaultBlocker(overrides = {}) {
  return {
    clauseDescription: 'emotions.joy >= 0.5',
    failureRate: 0.75,
    averageViolation: 0.3,
    rank: 1,
    severity: 'high',
    advancedAnalysis: {
      percentileAnalysis: { status: 'normal', insight: 'Normal' },
      nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'Moderate' },
      ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'Achievable' },
      lastMileAnalysis: { status: 'moderate', isDecisive: false, insight: 'Moderate' },
      recommendation: { action: 'tune_threshold', priority: 'medium', message: 'Tune' },
    },
    hierarchicalBreakdown: {
      variablePath: 'emotions.joy',
      comparisonOperator: '>=',
      thresholdValue: 0.5,
      violationP50: 0.2,
      violationP90: 0.4,
      nearMissRate: 0.08,
      nearMissEpsilon: 0.05,
      maxObservedValue: 0.6,
      ceilingGap: -0.1,
      lastMileFailRate: 0.3,
      othersPassedCount: 5000,
      isSingleClause: false,
    },
    ...overrides,
  };
}

function createBlockerWithCeilingDetected() {
  return createDefaultBlocker({
    advancedAnalysis: {
      ...createDefaultBlocker().advancedAnalysis,
      ceilingAnalysis: { status: 'ceiling_detected', achievable: false, gap: 0.2, insight: 'Ceiling' },
    },
  });
}

function createBlockerWithSingleClause() {
  return createDefaultBlocker({
    hierarchicalBreakdown: {
      ...createDefaultBlocker().hierarchicalBreakdown,
      isSingleClause: true,
    },
  });
}

function createBlockerWithHighNearMissRate() {
  return createDefaultBlocker({
    hierarchicalBreakdown: {
      ...createDefaultBlocker().hierarchicalBreakdown,
      nearMissRate: 0.15, // > 0.10 threshold
    },
  });
}

function createBlockerWithLowNearMissRate() {
  return createDefaultBlocker({
    hierarchicalBreakdown: {
      ...createDefaultBlocker().hierarchicalBreakdown,
      nearMissRate: 0.01, // < 0.02 threshold
    },
  });
}

function createBlockerWithMultipleFlags() {
  return createDefaultBlocker({
    advancedAnalysis: {
      ...createDefaultBlocker().advancedAnalysis,
      ceilingAnalysis: { status: 'ceiling_detected', achievable: false },
      lastMileAnalysis: { status: 'decisive_blocker', isDecisive: true },
    },
  });
}
```

### DI Container Setup

The integration test needs to set up the DI container properly:

```javascript
import { createContainer } from '../../../src/dependencyInjection/container.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';
import { uiTokens } from '../../../src/dependencyInjection/tokens/tokens-ui.js';

async function setupContainer() {
  const container = createContainer();

  // Register mocks for non-essential dependencies
  container.register(tokens.ILogger, () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));

  // Register real implementations
  // ... registration code ...

  return container;
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --verbose --coverage
```

### Coverage Requirements

- **Statements**: >= 80%
- **Branches**: >= 75%
- **Functions**: >= 80%
- **Lines**: >= 80%

### Invariants That Must Remain True

1. **DOM isolation**: Tests clean up DOM after each test
2. **Mock isolation**: Clipboard mock reset between tests
3. **Full flow coverage**: Tests exercise complete data flow from simulation to display
4. **Real component interaction**: Uses actual service instances, not mocks (except clipboard)
5. **No flaky tests**: Use appropriate async handling with deterministic waits
6. **DI container correctness**: Container properly resolves all dependencies

## Verification Commands

```bash
# Run integration tests with coverage
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --verbose --coverage

# Run in watch mode
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --watch

# Lint test file
npx eslint tests/integration/expression-diagnostics/monteCarloReport.integration.test.js
```

## Definition of Done

- [ ] Test file created at correct path
- [ ] Clipboard utils properly mocked
- [ ] DOM setup includes all required elements (from MONCARREPGEN-003)
- [ ] DI container properly configured with real services
- [ ] Full flow tests verify simulation → report → display
- [ ] Flag detection tests verify all 6 flags
- [ ] Rarity category tests verify boundary values
- [ ] Modal lifecycle tests verify show/hide/focus
- [ ] Error handling tests verify clipboard failures
- [ ] Helper functions created for test data
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Test file passes ESLint
- [ ] No flaky tests (deterministic waits)
- [ ] Tests complete in reasonable time (< 30 seconds)
