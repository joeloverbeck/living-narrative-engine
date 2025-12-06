/**
 * @file Unit tests for the TraceVisualizer class
 * @see src/actions/tracing/traceVisualizer.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TraceVisualizer from '../../../../src/actions/tracing/traceVisualizer.js';
import StructuredTrace from '../../../../src/actions/tracing/structuredTrace.js';

describe('TraceVisualizer', () => {
  let mockPerformanceNow;
  let timeCounter;
  let structuredTrace;
  let visualizer;

  beforeEach(() => {
    // Mock performance.now() for deterministic timing
    timeCounter = 1000;
    mockPerformanceNow = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => {
        const currentTime = timeCounter;
        return currentTime;
      });

    structuredTrace = new StructuredTrace();
    visualizer = new TraceVisualizer(structuredTrace);
  });

  afterEach(() => {
    mockPerformanceNow.mockRestore();
  });

  describe('constructor', () => {
    it('should create visualizer with valid StructuredTrace', () => {
      expect(visualizer).toBeInstanceOf(TraceVisualizer);
    });

    it('should throw error if structuredTrace is null', () => {
      expect(() => new TraceVisualizer(null)).toThrow(
        'Missing required dependency: IStructuredTrace.'
      );
    });

    it('should throw error if structuredTrace lacks required methods', () => {
      const invalidTrace = { someMethod: () => {} };
      expect(() => new TraceVisualizer(invalidTrace)).toThrow();
    });
  });

  describe('displayHierarchy', () => {
    it('should display message when no trace data', () => {
      const output = visualizer.displayHierarchy();
      expect(output).toContain('No trace data available.');
    });

    it('should display simple hierarchy', () => {
      const rootSpan = structuredTrace.startSpan('RootOperation');
      const childSpan = structuredTrace.startSpan('ChildOperation');
      timeCounter += 50;
      structuredTrace.endSpan(childSpan);
      timeCounter += 100;
      structuredTrace.endSpan(rootSpan);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('Trace Hierarchy');
      expect(output).toContain('└── RootOperation');
      expect(output).toContain('    └── ChildOperation');
      expect(output).toContain('(150.00ms)'); // Root duration
      expect(output).toContain('(50.00ms)'); // Child duration
    });

    it('should show critical path indicators', () => {
      const rootSpan = structuredTrace.startSpan('RootOp');
      const criticalChild = structuredTrace.startSpan('CriticalOp');
      timeCounter += 200; // Make this the critical path
      structuredTrace.endSpan(criticalChild);

      const normalChild = structuredTrace.startSpan('NormalOp');
      timeCounter += 50;
      structuredTrace.endSpan(normalChild);

      structuredTrace.endSpan(rootSpan);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('[CRITICAL]');
    });

    it('should allow disabling critical path indicators', () => {
      const rootSpan = structuredTrace.startSpan('RootOp');
      const criticalChild = structuredTrace.startSpan('CriticalOp');
      timeCounter += 200;
      structuredTrace.endSpan(criticalChild);

      const normalChild = structuredTrace.startSpan('NormalOp');
      timeCounter += 50;
      structuredTrace.endSpan(normalChild);

      structuredTrace.endSpan(rootSpan);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showCriticalPath: false,
      });

      expect(output).not.toContain('[CRITICAL]');
    });

    it('should show error indicators', () => {
      const span = structuredTrace.startSpan('ErrorOp');
      span.setError(new Error('Test error'));
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('❌');
      expect(output).toContain('Error: Test error');
    });

    it('should hide inline error details when disabled', () => {
      const span = structuredTrace.startSpan('ErrorOp');
      span.setError(new Error('Test error'));
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showErrors: false,
        showAttributes: false,
      });

      expect(output).toContain('ErrorOp');
      expect(output).not.toContain('Error: Test error');
    });

    it('should respect maxDepth option', () => {
      const root = structuredTrace.startSpan('Level0');
      const level1 = structuredTrace.startSpan('Level1');
      const level2 = structuredTrace.startSpan('Level2');
      const level3 = structuredTrace.startSpan('Level3');

      structuredTrace.endSpan(level3);
      structuredTrace.endSpan(level2);
      structuredTrace.endSpan(level1);
      structuredTrace.endSpan(root);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        maxDepth: 2,
      });

      expect(output).toContain('Level0');
      expect(output).toContain('Level1');
      expect(output).toContain('Level2');
      expect(output).not.toContain('Level3'); // Beyond max depth
    });

    it('should filter by minDuration', () => {
      const root = structuredTrace.startSpan('Root');

      const fastOp = structuredTrace.startSpan('FastOp');
      timeCounter += 10;
      structuredTrace.endSpan(fastOp);

      const slowOp = structuredTrace.startSpan('SlowOp');
      timeCounter += 200;
      structuredTrace.endSpan(slowOp);

      structuredTrace.endSpan(root);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        minDuration: 100,
      });

      expect(output).toContain('Root');
      expect(output).toContain('SlowOp');
      expect(output).not.toContain('FastOp'); // Filtered out
    });

    it('should show attributes when enabled', () => {
      const span = structuredTrace.startSpan('OpWithAttrs', {
        userId: 123,
        action: 'test',
      });
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showAttributes: true,
      });

      expect(output).toContain('userId: 123');
      expect(output).toContain('action: "test"');
    });

    it('should suppress attributes when disabled', () => {
      const span = structuredTrace.startSpan('AttrOp', {
        foo: 'bar',
      });
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showAttributes: false,
      });

      expect(output).toContain('AttrOp');
      expect(output).not.toContain('foo:');
    });

    it('should format attribute prefixes for intermediate nodes', () => {
      const root = structuredTrace.startSpan('Root');

      const firstChild = structuredTrace.startSpan('FirstChild', {
        foo: 'bar',
      });
      structuredTrace.endSpan(firstChild);

      const secondChild = structuredTrace.startSpan('SecondChild');
      structuredTrace.endSpan(secondChild);

      structuredTrace.endSpan(root);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showAttributes: true,
      });

      expect(output).toContain('├── FirstChild');
      expect(output).toContain('│     foo: "bar"');
      expect(output).toContain('└── SecondChild');
    });

    it('should handle complex hierarchy with multiple children', () => {
      const root = structuredTrace.startSpan('Root');

      const child1 = structuredTrace.startSpan('Child1');
      structuredTrace.endSpan(child1);

      const child2 = structuredTrace.startSpan('Child2');
      const grandchild = structuredTrace.startSpan('Grandchild');
      structuredTrace.endSpan(grandchild);
      structuredTrace.endSpan(child2);

      const child3 = structuredTrace.startSpan('Child3');
      structuredTrace.endSpan(child3);

      structuredTrace.endSpan(root);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('├── Child1');
      expect(output).toContain('├── Child2');
      expect(output).toContain('│   └── Grandchild');
      expect(output).toContain('└── Child3');
    });
  });

  describe('displayWaterfall', () => {
    it('should display message when no trace data', () => {
      const output = visualizer.displayWaterfall();
      expect(output).toContain('No trace data available.');
    });

    it('should display message when no completed spans', () => {
      structuredTrace.startSpan('IncompleteOp'); // Don't end it
      const output = visualizer.displayWaterfall();
      expect(output).toContain('No completed spans available');
    });

    it('should display waterfall timeline', () => {
      const span1 = structuredTrace.startSpan('Op1');
      timeCounter += 100;
      structuredTrace.endSpan(span1);

      const span2 = structuredTrace.startSpan('Op2');
      timeCounter += 50;
      structuredTrace.endSpan(span2);

      const output = visualizer.displayWaterfall({ colorsEnabled: false });

      expect(output).toContain('Trace Waterfall');
      expect(output).toContain('Timeline:');
      expect(output).toContain('Op1 (100.00ms)');
      expect(output).toContain('Op2 (50.00ms)');
      expect(output).toContain('█'); // Timeline bars
    });

    it('should show concurrent operations', () => {
      const span1 = structuredTrace.startSpan('Op1');
      timeCounter += 50;
      const span2 = structuredTrace.startSpan('Op2'); // Starts before Op1 ends
      timeCounter += 50;
      structuredTrace.endSpan(span2); // End span2 first (LIFO)
      timeCounter += 50;
      structuredTrace.endSpan(span1);

      const output = visualizer.displayWaterfall({ colorsEnabled: false });

      // Both operations should be visible with overlapping timelines
      expect(output).toContain('Op1');
      expect(output).toContain('Op2');
    });

    it('should apply filters', () => {
      const root = structuredTrace.startSpan('Root');

      const child1 = structuredTrace.startSpan('FastChild');
      timeCounter += 10;
      structuredTrace.endSpan(child1);

      const child2 = structuredTrace.startSpan('SlowChild');
      timeCounter += 200;
      structuredTrace.endSpan(child2);

      structuredTrace.endSpan(root);

      const output = visualizer.displayWaterfall({
        colorsEnabled: false,
        minDuration: 100,
      });

      expect(output).toContain('Root');
      expect(output).toContain('SlowChild');
      expect(output).not.toContain('FastChild');
    });

    it('should highlight critical path operations', () => {
      const root = structuredTrace.startSpan('Root');
      const critical = structuredTrace.startSpan('CriticalOp');
      timeCounter += 300;
      structuredTrace.endSpan(critical);
      structuredTrace.endSpan(root);

      const output = visualizer.displayWaterfall({
        colorsEnabled: false,
        showCriticalPath: true,
      });

      expect(output).toContain('[CRITICAL]');
    });

    it('should allow hiding critical path data from the waterfall', () => {
      const root = structuredTrace.startSpan('Root');
      const critical = structuredTrace.startSpan('CriticalOp');
      timeCounter += 300;
      structuredTrace.endSpan(critical);
      structuredTrace.endSpan(root);

      const output = visualizer.displayWaterfall({
        colorsEnabled: false,
        showCriticalPath: false,
      });

      expect(output).not.toContain('[CRITICAL]');
    });

    it('should filter waterfall entries by maxDepth', () => {
      const root = structuredTrace.startSpan('Root');

      const child = structuredTrace.startSpan('Child');
      timeCounter += 50;
      const grandchild = structuredTrace.startSpan('Grandchild');
      timeCounter += 50;
      structuredTrace.endSpan(grandchild);
      structuredTrace.endSpan(child);

      structuredTrace.endSpan(root);

      const output = visualizer.displayWaterfall({
        colorsEnabled: false,
        maxDepth: 1,
      });

      expect(output).toContain('Root');
      expect(output).toContain('Child');
      expect(output).not.toContain('Grandchild');
    });

    it('should highlight error spans in the waterfall view', () => {
      const root = structuredTrace.startSpan('Root');
      const errorSpan = structuredTrace.startSpan('ErrorOp');
      errorSpan.setError(new Error('Boom'));
      timeCounter += 120;
      structuredTrace.endSpan(errorSpan);
      structuredTrace.endSpan(root);

      const output = visualizer.displayWaterfall({
        colorsEnabled: true,
        showCriticalPath: false,
      });

      expect(output).toContain('ErrorOp (120.00ms)');
      expect(output).toContain('\x1b[31m'); // Red color applied to error bar
    });
  });

  describe('displaySummary', () => {
    beforeEach(() => {
      // Create some test data
      const root = structuredTrace.startSpan('RootOp');

      const slow = structuredTrace.startSpan('SlowOp');
      timeCounter += 200;
      structuredTrace.endSpan(slow);

      const fast = structuredTrace.startSpan('FastOp');
      timeCounter += 50;
      structuredTrace.endSpan(fast);

      const error = structuredTrace.startSpan('ErrorOp');
      error.setError(new Error('Test'));
      timeCounter += 100;
      structuredTrace.endSpan(error);

      timeCounter += 50;
      structuredTrace.endSpan(root);
    });

    it('should display trace summary', () => {
      const output = visualizer.displaySummary({ colorsEnabled: false });

      expect(output).toContain('Trace Summary');
      expect(output).toContain('Total Duration: 400.00ms');
      expect(output).toContain('Operation Count: 4');
      expect(output).toContain('Error Count: 1');
    });

    it('should show critical path', () => {
      const output = visualizer.displaySummary({ colorsEnabled: false });

      expect(output).toContain('Critical Path:');
      expect(output).toContain('• RootOp');
      expect(output).toContain('• SlowOp');
    });

    it('should show slowest operations', () => {
      const output = visualizer.displaySummary({ colorsEnabled: false });

      expect(output).toContain('Slowest Operations:');
      expect(output).toContain('RootOp: 400.00ms');
      expect(output).toContain('SlowOp: 200.00ms');
    });

    it('should show operation time distribution', () => {
      const output = visualizer.displaySummary({ colorsEnabled: false });

      expect(output).toContain('Operation Time Distribution:');
      expect(output).toContain('SlowOp:');
      expect(output).toContain('%');
    });

    it('should handle traces without spans gracefully', () => {
      const emptyTrace = new StructuredTrace();
      const emptyVisualizer = new TraceVisualizer(emptyTrace);

      const output = emptyVisualizer.displaySummary({ colorsEnabled: false });

      expect(output).toContain('Total Duration: 0.00ms');
      expect(output).not.toContain('Critical Path:');
      expect(output).not.toContain('Slowest Operations:');
    });

    it('should allow omitting visualization options', () => {
      const output = visualizer.displaySummary();

      expect(output).toContain('Trace Summary');
    });
  });

  describe('displayErrors', () => {
    it('should display message when no errors', () => {
      const span = structuredTrace.startSpan('SuccessOp');
      structuredTrace.endSpan(span);

      const output = visualizer.displayErrors();
      expect(output).toContain('No errors found in trace.');
    });

    it('should display error details', () => {
      const span1 = structuredTrace.startSpan('ErrorOp1', { userId: 123 });
      span1.setError(new Error('First error'));
      timeCounter += 100;
      structuredTrace.endSpan(span1);

      const span2 = structuredTrace.startSpan('ErrorOp2');
      span2.setError(new Error('Second error'));
      timeCounter += 50;
      structuredTrace.endSpan(span2);

      const output = visualizer.displayErrors({ colorsEnabled: false });

      expect(output).toContain('Trace Errors');
      expect(output).toContain('Found 2 error(s):');
      expect(output).toContain('1. ErrorOp1');
      expect(output).toContain('Error: First error');
      expect(output).toContain('Duration: 100.00ms');
      expect(output).toContain('2. ErrorOp2');
      expect(output).toContain('Error: Second error');
    });

    it('should render error prefixes for intermediate nodes', () => {
      const root = structuredTrace.startSpan('Root');

      const firstError = structuredTrace.startSpan('FirstError');
      firstError.setError(new Error('first'));
      structuredTrace.endSpan(firstError);

      const secondError = structuredTrace.startSpan('SecondError');
      secondError.setError(new Error('second'));
      structuredTrace.endSpan(secondError);

      structuredTrace.endSpan(root);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('├── FirstError');
      expect(output).toContain('│     Error: first');
      expect(output).toContain('└── SecondError');
    });

    it('should show attributes when enabled', () => {
      const span = structuredTrace.startSpan('ErrorOp', {
        userId: 123,
        action: 'test',
      });
      span.setError(new Error('Test error'));
      structuredTrace.endSpan(span);

      const output = visualizer.displayErrors({
        colorsEnabled: false,
        showAttributes: true,
      });

      expect(output).toContain('Attributes:');
      expect(output).toContain('userId: 123');
      expect(output).toContain('action: "test"');
    });

    it('should omit timing details when disabled', () => {
      const span = structuredTrace.startSpan('ErrorOp');
      span.setError(new Error('Test error'));
      timeCounter += 75;
      structuredTrace.endSpan(span);

      const output = visualizer.displayErrors({
        colorsEnabled: false,
        showTimings: false,
        showAttributes: false,
      });

      expect(output).toContain('ErrorOp');
      expect(output).not.toContain('Duration:');
    });

    it('should handle spans without error details', () => {
      const span = structuredTrace.startSpan('ErrorWithoutDetails');
      span.setStatus('error');
      timeCounter += 20;
      structuredTrace.endSpan(span);

      const output = visualizer.displayErrors({ colorsEnabled: false });

      expect(output).toContain('ErrorWithoutDetails');
      expect(output).not.toContain('Error:');
    });
  });

  describe('getAllDisplays', () => {
    beforeEach(() => {
      const span = structuredTrace.startSpan('TestOp');
      timeCounter += 100;
      structuredTrace.endSpan(span);
    });

    it('should return all display outputs', () => {
      const displays = visualizer.getAllDisplays({ colorsEnabled: false });

      expect(displays).toHaveProperty('hierarchy');
      expect(displays).toHaveProperty('waterfall');
      expect(displays).toHaveProperty('summary');
      expect(displays).toHaveProperty('errors');

      expect(displays.hierarchy).toContain('Trace Hierarchy');
      expect(displays.waterfall).toContain('Trace Waterfall');
      expect(displays.summary).toContain('Trace Summary');
      expect(displays.errors).toContain('No errors found');
    });

    it('should pass options to all displays', () => {
      const displays = visualizer.getAllDisplays({
        colorsEnabled: false,
        showAttributes: false,
        showTimings: false,
      });

      // Should not contain timing information
      expect(displays.hierarchy).not.toContain('ms)');
    });

    it('should use defaults when options are omitted', () => {
      const displays = visualizer.getAllDisplays();

      expect(displays.hierarchy).toContain('Trace Hierarchy');
      expect(displays.waterfall).toContain('Trace Waterfall');
      expect(displays.summary).toContain('Trace Summary');
      expect(displays.errors).toBeDefined();
    });
  });

  describe('color handling', () => {
    it('should apply colors when enabled', () => {
      const span = structuredTrace.startSpan('TestOp');
      span.setError(new Error('Error'));
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({ colorsEnabled: true });

      // Should contain ANSI color codes
      expect(output).toContain('\x1b[31m'); // Red for error
      expect(output).toContain('\x1b[0m'); // Reset
    });

    it('should not apply colors when disabled', () => {
      const span = structuredTrace.startSpan('TestOp');
      span.setError(new Error('Error'));
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      // Should not contain ANSI color codes
      expect(output).not.toContain('\x1b[');
    });
  });

  describe('edge cases', () => {
    it('should handle spans with no duration', () => {
      const incompleteSpan = structuredTrace.startSpan('IncompleteOp');
      // Don't end it

      const completeSpan = structuredTrace.startSpan('CompleteOp');
      structuredTrace.endSpan(completeSpan);

      const hierarchyOutput = visualizer.displayHierarchy({
        colorsEnabled: false,
      });
      const waterfallOutput = visualizer.displayWaterfall({
        colorsEnabled: false,
      });

      // Hierarchy should show all spans
      expect(hierarchyOutput).toContain('IncompleteOp');
      expect(hierarchyOutput).toContain('CompleteOp');

      // Waterfall should only show completed spans
      expect(waterfallOutput).toContain('CompleteOp');
      expect(waterfallOutput).not.toContain('IncompleteOp');
    });

    it('should handle empty attributes', () => {
      const span = structuredTrace.startSpan('OpNoAttrs');
      structuredTrace.endSpan(span);

      const output = visualizer.displayHierarchy({
        colorsEnabled: false,
        showAttributes: true,
      });

      // Should not crash and should not show attributes section
      expect(output).toContain('OpNoAttrs');
    });

    it('should handle very deep hierarchies', () => {
      let currentSpan = structuredTrace.startSpan('Level0');

      // Create 10 levels deep
      for (let i = 1; i <= 10; i++) {
        currentSpan = structuredTrace.startSpan(`Level${i}`);
      }

      // End all spans
      for (let i = 10; i >= 0; i--) {
        structuredTrace.endSpan(currentSpan);
        currentSpan = structuredTrace.getActiveSpan();
      }

      const output = visualizer.displayHierarchy({ colorsEnabled: false });

      expect(output).toContain('Level0');
      expect(output).toContain('Level10');
    });
  });
});
