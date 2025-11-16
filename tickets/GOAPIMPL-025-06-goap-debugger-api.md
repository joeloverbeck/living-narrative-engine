# GOAPIMPL-025-06: GOAP Debugger Main API

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: MEDIUM
**Estimated Effort**: 1 hour
**Dependencies**: 
- GOAPIMPL-025-01 (GoapController Debug API)
- GOAPIMPL-025-03 (Plan Inspector)
- GOAPIMPL-025-04 (State Diff Viewer)
- GOAPIMPL-025-05 (Refinement Tracer)

## Description

Create the main GOAP Debugger API that coordinates all debug tools and provides a unified interface for debugging GOAP system. This is the primary entry point for developers and will be registered in DI as `IGOAPDebugger`.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] Unified API for all debug tools
- [ ] Plan inspection methods
- [ ] State diff methods
- [ ] Refinement tracing methods
- [ ] Combined reporting functionality
- [ ] Registered in DI container
- [ ] Unit tests validate API
- [ ] Integration tests validate full workflow

## Current State Analysis

### Debug Tools Available

From previous tickets:
1. **PlanInspector** - Displays active plans
2. **StateDiffViewer** - Shows state changes
3. **RefinementTracer** - Captures refinement execution

### DI Integration

From `src/dependencyInjection/tokens/tokens-core.js`:
- Need to add: `IGOAPDebugger: 'IGOAPDebugger'`

From `src/dependencyInjection/registrations/goapRegistrations.js`:
- Need to register debugger with dependencies

## Implementation Details

### File to Create

`src/goap/debug/goapDebugger.js`

```javascript
/**
 * @file Main GOAP debugger API
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Main debugging API for GOAP system.
 * Coordinates all debug tools and provides unified interface.
 */
class GOAPDebugger {
  #goapController;
  #planInspector;
  #stateDiffViewer;
  #refinementTracer;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.goapController - GOAP controller
   * @param {object} deps.planInspector - Plan inspection tool
   * @param {object} deps.stateDiffViewer - State diff tool
   * @param {object} deps.refinementTracer - Refinement tracing tool
   * @param {object} deps.logger - Logger instance
   */
  constructor({
    goapController,
    planInspector,
    stateDiffViewer,
    refinementTracer,
    logger,
  }) {
    validateDependency(goapController, 'IGoapController', logger, {
      requiredMethods: ['getActivePlan'],
    });
    
    this.#goapController = goapController;
    this.#planInspector = planInspector;
    this.#stateDiffViewer = stateDiffViewer;
    this.#refinementTracer = refinementTracer;
    this.#logger = logger;
  }

  // ==================== Plan Inspection ====================

  /**
   * Inspect active plan for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {string} Formatted plan text
   */
  inspectPlan(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.inspectPlan', this.#logger);
    return this.#planInspector.inspect(actorId);
  }

  /**
   * Get active plan as JSON.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Plan data
   */
  inspectPlanJSON(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.inspectPlanJSON', this.#logger);
    return this.#planInspector.inspectJSON(actorId);
  }

  /**
   * Get current goal for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Current goal
   */
  inspectCurrentGoal(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.inspectCurrentGoal', this.#logger);
    
    const plan = this.#goapController.getActivePlan(actorId);
    return plan ? plan.goal : null;
  }

  /**
   * Get failure history for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {object} Failed goals and tasks
   */
  getFailureHistory(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.getFailureHistory', this.#logger);
    
    return {
      failedGoals: this.#goapController.getFailedGoals(actorId),
      failedTasks: this.#goapController.getFailedTasks(actorId),
    };
  }

  // ==================== State Visualization ====================

  /**
   * Show state diff between two planning states.
   * @param {object} beforeState - State before task
   * @param {object} afterState - State after task
   * @param {object} [options] - Formatting options
   * @returns {string} Formatted diff text
   */
  showStateDiff(beforeState, afterState, options = {}) {
    const diff = this.#stateDiffViewer.diff(beforeState, afterState);
    return this.#stateDiffViewer.visualize(diff, options);
  }

  /**
   * Get state diff as JSON.
   * @param {object} beforeState - State before task
   * @param {object} afterState - State after task
   * @returns {object} Diff data
   */
  showStateDiffJSON(beforeState, afterState) {
    return this.#stateDiffViewer.diffJSON(beforeState, afterState);
  }

  // ==================== Refinement Tracing ====================

  /**
   * Start capturing refinement trace for an actor.
   * @param {string} actorId - Actor entity ID
   */
  startTrace(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.startTrace', this.#logger);
    this.#refinementTracer.startCapture(actorId);
  }

  /**
   * Stop capturing and return trace for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Trace data
   */
  stopTrace(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.stopTrace', this.#logger);
    return this.#refinementTracer.stopCapture(actorId);
  }

  /**
   * Get current trace without stopping.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Current trace
   */
  getTrace(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.getTrace', this.#logger);
    return this.#refinementTracer.getTrace(actorId);
  }

  /**
   * Format trace as text.
   * @param {object} trace - Trace from stopTrace() or getTrace()
   * @returns {string} Formatted trace
   */
  formatTrace(trace) {
    return this.#refinementTracer.format(trace);
  }

  // ==================== Combined Reporting ====================

  /**
   * Generate comprehensive debug report for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {string} Complete debug report
   */
  generateReport(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.generateReport', this.#logger);
    
    let report = '';
    report += `=== GOAP Debug Report: ${actorId} ===\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `\n`;
    
    // Plan inspection
    report += `--- Active Plan ---\n`;
    report += this.#planInspector.inspect(actorId);
    report += `\n`;
    
    // Failure history
    const failures = this.getFailureHistory(actorId);
    report += `--- Failure History ---\n`;
    report += `Failed Goals: ${failures.failedGoals.length}\n`;
    for (const failure of failures.failedGoals) {
      report += `  - ${failure.goalId}: ${failure.reason} (${new Date(failure.timestamp).toISOString()})\n`;
    }
    report += `Failed Tasks: ${failures.failedTasks.length}\n`;
    for (const failure of failures.failedTasks) {
      report += `  - ${failure.taskId}: ${failure.reason} (${new Date(failure.timestamp).toISOString()})\n`;
    }
    report += `\n`;
    
    // Current trace (if any)
    const trace = this.getTrace(actorId);
    if (trace) {
      report += `--- Active Trace ---\n`;
      report += this.formatTrace(trace);
      report += `\n`;
    }
    
    report += `=== End Report ===\n`;
    
    return report;
  }

  /**
   * Generate report as JSON.
   * @param {string} actorId - Actor entity ID
   * @returns {object} Debug report data
   */
  generateReportJSON(actorId) {
    assertNonBlankString(actorId, 'actorId', 'GOAPDebugger.generateReportJSON', this.#logger);
    
    return {
      actorId,
      timestamp: Date.now(),
      plan: this.inspectPlanJSON(actorId),
      failures: this.getFailureHistory(actorId),
      trace: this.getTrace(actorId),
    };
  }
}

export default GOAPDebugger;
```

### DI Token Registration

File: `src/dependencyInjection/tokens/tokens-core.js`

Add to tokens object:
```javascript
export const tokens = {
  // ... existing tokens
  
  // GOAP Debug (add after GOAP section)
  IGOAPDebugger: 'IGOAPDebugger',
};
```

### DI Registration

File: `src/dependencyInjection/registrations/goapRegistrations.js`

Add after existing GOAP registrations:
```javascript
import GOAPDebugger from '../../goap/debug/goapDebugger.js';
import PlanInspector from '../../goap/debug/planInspector.js';
import StateDiffViewer from '../../goap/debug/stateDiffViewer.js';
import RefinementTracer from '../../goap/debug/refinementTracer.js';

// ... in registerGOAPServices function, add:

// Debug tools
container.registerFactory(tokens.IPlanInspector, () =>
  bind({
    goapController: tokens.IGoapController,
    dataRegistry: tokens.IDataRegistry,
    entityManager: tokens.IEntityManager,
    logger: tokens.ILogger,
  })(PlanInspector)
);

container.registerFactory(tokens.IStateDiffViewer, () =>
  bind({
    logger: tokens.ILogger,
  })(StateDiffViewer)
);

container.registerFactory(tokens.IRefinementTracer, () =>
  bind({
    eventBus: tokens.IEventBus,
    dataRegistry: tokens.IDataRegistry,
    logger: tokens.ILogger,
  })(RefinementTracer)
);

container.registerFactory(tokens.IGOAPDebugger, () =>
  bind({
    goapController: tokens.IGoapController,
    planInspector: tokens.IPlanInspector,
    stateDiffViewer: tokens.IStateDiffViewer,
    refinementTracer: tokens.IRefinementTracer,
    logger: tokens.ILogger,
  })(GOAPDebugger)
);
```

Add tokens for debug tools:
```javascript
// In tokens-core.js, add:
IPlanInspector: 'IPlanInspector',
IStateDiffViewer: 'IStateDiffViewer',
IRefinementTracer: 'IRefinementTracer',
```

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/debug/goapDebugger.test.js`

**Test Cases**:

1. **Plan Inspection**:
   - Delegates to PlanInspector
   - Returns formatted text
   - Returns JSON format
   - Handles no active plan

2. **State Diff**:
   - Delegates to StateDiffViewer
   - Returns formatted diff
   - Returns JSON format

3. **Refinement Tracing**:
   - Starts/stops trace
   - Gets current trace
   - Formats trace output

4. **Combined Reporting**:
   - Generates complete report
   - Includes all sections
   - Returns JSON format

**Test Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';

describe('GOAPDebugger', () => {
  let testBed;
  let debugger;
  let mockController;
  let mockInspector;
  let mockDiffViewer;
  let mockTracer;

  beforeEach(() => {
    testBed = createTestBed();
    
    mockController = testBed.createMock('IGoapController', [
      'getActivePlan',
      'getFailedGoals',
      'getFailedTasks',
    ]);
    
    mockInspector = testBed.createMock('IPlanInspector', [
      'inspect',
      'inspectJSON',
    ]);
    
    mockDiffViewer = testBed.createMock('IStateDiffViewer', [
      'diff',
      'visualize',
      'diffJSON',
    ]);
    
    mockTracer = testBed.createMock('IRefinementTracer', [
      'startCapture',
      'stopCapture',
      'getTrace',
      'format',
    ]);
    
    debugger = new GOAPDebugger({
      goapController: mockController,
      planInspector: mockInspector,
      stateDiffViewer: mockDiffViewer,
      refinementTracer: mockTracer,
      logger: testBed.createMockLogger(),
    });
  });

  describe('inspectPlan', () => {
    it('should delegate to plan inspector', () => {
      mockInspector.inspect.mockReturnValue('plan output');
      
      const result = debugger.inspectPlan('actor-1');
      
      expect(mockInspector.inspect).toHaveBeenCalledWith('actor-1');
      expect(result).toBe('plan output');
    });
  });

  describe('generateReport', () => {
    it('should generate combined report', () => {
      mockInspector.inspect.mockReturnValue('=== Plan ===\n');
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);
      mockTracer.getTrace.mockReturnValue(null);
      
      const report = debugger.generateReport('actor-1');
      
      expect(report).toContain('GOAP Debug Report');
      expect(report).toContain('Active Plan');
      expect(report).toContain('Failure History');
    });
  });

  // ... other test suites
});
```

### Integration Tests

Create: `tests/integration/goap/debug/goapDebuggerIntegration.test.js`

Test full workflow with real GOAP system:

```javascript
it('should provide complete debug workflow', async () => {
  const debugger = container.resolve(tokens.IGOAPDebugger);
  
  // Start trace
  debugger.startTrace('actor-1');
  
  // Execute turn
  await goapController.decideTurn(actor, world);
  
  // Generate report
  const report = debugger.generateReport('actor-1');
  
  console.log(report);
  
  expect(report).toContain('Active Plan');
  expect(report).toContain('Failure History');
  expect(report).toContain('Active Trace');
  
  // Stop trace
  const trace = debugger.stopTrace('actor-1');
  expect(trace.events.length).toBeGreaterThan(0);
});
```

## Manual Testing

1. **Console Usage**:
   ```javascript
   // In browser console or debug script
   const debugger = container.resolve('IGOAPDebugger');
   
   // Inspect plan
   console.log(debugger.inspectPlan('actor-123'));
   
   // Start tracing
   debugger.startTrace('actor-123');
   
   // Execute turn (trigger refinement)
   await goapController.decideTurn(actor, world);
   
   // Get comprehensive report
   console.log(debugger.generateReport('actor-123'));
   ```

2. **Expected Report**:
   ```
   === GOAP Debug Report: actor-123 ===
   Generated: 2025-11-16T12:34:56.789Z

   --- Active Plan ---
   === GOAP Plan: Achieve 'stay_fed' ===
   ...plan details...

   --- Failure History ---
   Failed Goals: 0
   Failed Tasks: 0

   --- Active Trace ---
   === Refinement Trace: actor-123 ===
   ...trace details...

   === End Report ===
   ```

## Success Validation

✅ **Done when**:
- GOAPDebugger class implemented
- All delegation methods working
- Combined reporting functional
- DI token added to tokens-core.js
- DI registration in goapRegistrations.js complete
- Unit tests pass with coverage
- Integration tests pass
- Manual testing confirms usability
- No TypeScript errors
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Inspector: `tickets/GOAPIMPL-025-03-plan-inspector.md`
- Diff Viewer: `tickets/GOAPIMPL-025-04-state-diff-viewer.md`
- Tracer: `tickets/GOAPIMPL-025-05-refinement-tracer.md`
- Controller API: `tickets/GOAPIMPL-025-01-goapcontroller-debug-api.md`
- DI: `src/dependencyInjection/registrations/goapRegistrations.js`
- Tokens: `src/dependencyInjection/tokens/tokens-core.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
