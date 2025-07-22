/**
 * @file Unit tests for the StructuredTrace class
 * @see src/actions/tracing/structuredTrace.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import StructuredTrace from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import Span from '../../../../src/actions/tracing/span.js';

describe('StructuredTrace', () => {
  let mockPerformanceNow;
  let timeCounter;

  beforeEach(() => {
    // Mock performance.now() for deterministic timing
    timeCounter = 0;
    mockPerformanceNow = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => timeCounter++);
  });

  afterEach(() => {
    mockPerformanceNow.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with new TraceContext if none provided', () => {
      const trace = new StructuredTrace();
      expect(trace.logs).toEqual([]);
    });

    it('should wrap existing TraceContext if provided', () => {
      const existingContext = new TraceContext();
      existingContext.info('test', 'source');

      const trace = new StructuredTrace(existingContext);
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].message).toBe('test');
    });
  });

  describe('backward compatibility - TraceContext delegation', () => {
    let trace;

    beforeEach(() => {
      trace = new StructuredTrace();
    });

    it('should delegate addLog to TraceContext', () => {
      trace.addLog('info', 'test message', 'test source', { data: 'test' });
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0]).toMatchObject({
        type: 'info',
        message: 'test message',
        source: 'test source',
        data: { data: 'test' },
      });
    });

    it('should delegate info to TraceContext', () => {
      trace.info('info message', 'source');
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('info');
    });

    it('should delegate success to TraceContext', () => {
      trace.success('success message', 'source');
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('success');
    });

    it('should delegate failure to TraceContext', () => {
      trace.failure('failure message', 'source');
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('failure');
    });

    it('should delegate step to TraceContext', () => {
      trace.step('step message', 'source');
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('step');
    });

    it('should delegate error to TraceContext', () => {
      trace.error('error message', 'source');
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('error');
    });

    it('should delegate data to TraceContext', () => {
      trace.data('data message', 'source', { key: 'value' });
      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0].type).toBe('data');
      expect(trace.logs[0].data).toEqual({ key: 'value' });
    });
  });

  describe('span management', () => {
    let trace;

    beforeEach(() => {
      trace = new StructuredTrace();
    });

    describe('startSpan', () => {
      it('should create root span when no active span', () => {
        const span = trace.startSpan('RootOperation');

        expect(span).toBeInstanceOf(Span);
        expect(span.operation).toBe('RootOperation');
        expect(span.parentId).toBeNull();
        expect(trace.getActiveSpan()).toBe(span);
      });

      it('should create child span when active span exists', () => {
        const root = trace.startSpan('RootOperation');
        const child = trace.startSpan('ChildOperation');

        expect(child.parentId).toBe(root.id);
        expect(root.children).toContain(child);
        expect(trace.getActiveSpan()).toBe(child);
      });

      it('should set attributes if provided', () => {
        const span = trace.startSpan('Operation', { key: 'value', num: 42 });

        expect(span.attributes).toEqual({ key: 'value', num: 42 });
      });

      it('should handle empty attributes', () => {
        const span = trace.startSpan('Operation', {});
        expect(span.attributes).toEqual({});
      });
    });

    describe('endSpan', () => {
      it('should end the active span', () => {
        const span = trace.startSpan('Operation');
        trace.endSpan(span);

        expect(span.endTime).not.toBeNull();
        expect(span.duration).not.toBeNull();
        expect(trace.getActiveSpan()).toBeNull();
      });

      it('should restore parent as active span', () => {
        const root = trace.startSpan('Root');
        const child = trace.startSpan('Child');

        trace.endSpan(child);

        expect(trace.getActiveSpan()).toBe(root);
      });

      it('should throw error if span is not active', () => {
        const span1 = trace.startSpan('Operation1');
        const span2 = trace.startSpan('Operation2');

        expect(() => trace.endSpan(span1)).toThrow(
          'Cannot end span 1 - it is not the currently active span'
        );
      });

      it('should throw error for invalid span', () => {
        expect(() => trace.endSpan(null)).toThrow(
          'endSpan requires a valid Span instance'
        );
        expect(() => trace.endSpan({})).toThrow(
          'endSpan requires a valid Span instance'
        );
      });
    });

    describe('withSpan', () => {
      it('should execute function within span', () => {
        const result = trace.withSpan('TestOp', () => {
          return 'result';
        });

        expect(result).toBe('result');

        const spans = trace.getSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].operation).toBe('TestOp');
        expect(spans[0].status).toBe('success');
        expect(spans[0].duration).not.toBeNull();
      });

      it('should capture errors', () => {
        const error = new Error('Test error');

        expect(() =>
          trace.withSpan('ErrorOp', () => {
            throw error;
          })
        ).toThrow('Test error');

        const spans = trace.getSpans();
        expect(spans[0].status).toBe('error');
        expect(spans[0].error).toBe(error);
      });

      it('should set attributes', () => {
        trace.withSpan('AttrOp', () => 'result', {
          attr1: 'value1',
          attr2: 42,
        });

        const spans = trace.getSpans();
        expect(spans[0].attributes).toMatchObject({
          attr1: 'value1',
          attr2: 42,
        });
      });

      it('should restore active span after execution', () => {
        const root = trace.startSpan('Root');

        trace.withSpan('Child', () => {
          expect(trace.getActiveSpan().operation).toBe('Child');
        });

        expect(trace.getActiveSpan()).toBe(root);
      });
    });

    describe('withSpanAsync', () => {
      it('should execute async function within span', async () => {
        const result = await trace.withSpanAsync('AsyncOp', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'async result';
        });

        expect(result).toBe('async result');

        const spans = trace.getSpans();
        expect(spans[0].operation).toBe('AsyncOp');
        expect(spans[0].status).toBe('success');
      });

      it('should capture async errors', async () => {
        const error = new Error('Async error');

        await expect(
          trace.withSpanAsync('AsyncErrorOp', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw error;
          })
        ).rejects.toThrow('Async error');

        const spans = trace.getSpans();
        expect(spans[0].status).toBe('error');
        expect(spans[0].error).toBe(error);
      });

      it('should handle nested async spans', async () => {
        await trace.withSpanAsync('Parent', async () => {
          await trace.withSpanAsync('Child1', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
          });

          await trace.withSpanAsync('Child2', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
          });
        });

        const spans = trace.getSpans();
        expect(spans).toHaveLength(3);
        expect(spans[0].operation).toBe('Parent');
        expect(spans[0].children).toHaveLength(2);
      });
    });
  });

  describe('analysis methods', () => {
    let trace;

    beforeEach(() => {
      trace = new StructuredTrace();
    });

    describe('getHierarchicalView', () => {
      it('should return null when no spans', () => {
        expect(trace.getHierarchicalView()).toBeNull();
      });

      it('should return hierarchical structure', () => {
        trace.withSpan('Root', () => {
          trace.withSpan('Child1', () => {});
          trace.withSpan('Child2', () => {
            trace.withSpan('Grandchild', () => {});
          });
        });

        const view = trace.getHierarchicalView();
        expect(view).toMatchObject({
          operation: 'Root',
          status: 'success',
          children: [
            {
              operation: 'Child1',
              status: 'success',
              children: [],
            },
            {
              operation: 'Child2',
              status: 'success',
              children: [
                {
                  operation: 'Grandchild',
                  status: 'success',
                  children: [],
                },
              ],
            },
          ],
        });
      });

      it('should include error information', () => {
        try {
          trace.withSpan('ErrorOp', () => {
            throw new Error('Test error');
          });
        } catch {}

        const view = trace.getHierarchicalView();
        expect(view.error).toBe('Test error');
      });
    });

    describe('getPerformanceSummary', () => {
      it('should return empty summary when no spans', () => {
        const summary = trace.getPerformanceSummary();
        expect(summary).toEqual({
          totalDuration: 0,
          operationCount: 0,
          criticalPath: [],
          slowestOperations: [],
          errorCount: 0,
          operationStats: {},
        });
      });

      it('should calculate performance metrics', () => {
        // Create a more complex timing scenario
        mockPerformanceNow.mockRestore();
        let time = 0;
        mockPerformanceNow = jest
          .spyOn(performance, 'now')
          .mockImplementation(() => {
            const current = time;
            time += 10; // Each call advances by 10ms
            return current;
          });

        trace.withSpan('Root', () => {
          trace.withSpan('FastOp', () => {});
          trace.withSpan('SlowOp', () => {
            trace.withSpan('SubOp', () => {});
          });
        });

        const summary = trace.getPerformanceSummary();

        expect(summary.operationCount).toBe(4);
        expect(summary.totalDuration).toBe(70); // Root span duration
        expect(summary.errorCount).toBe(0);
        expect(summary.slowestOperations[0].operation).toBe('Root');
        expect(summary.criticalPath).toEqual(['Root', 'SlowOp', 'SubOp']);
        expect(summary.operationStats).toHaveProperty('Root');
        expect(summary.operationStats).toHaveProperty('FastOp');
        expect(summary.operationStats).toHaveProperty('SlowOp');
        expect(summary.operationStats).toHaveProperty('SubOp');
      });

      it('should count errors', () => {
        try {
          trace.withSpan('Op1', () => {});
          trace.withSpan('Op2', () => {
            throw new Error('Error');
          });
        } catch {}

        const summary = trace.getPerformanceSummary();
        expect(summary.errorCount).toBe(1);
      });
    });

    describe('getCriticalPath', () => {
      it('should return empty array when no spans', () => {
        expect(trace.getCriticalPath()).toEqual([]);
      });

      it('should identify critical path', () => {
        trace.withSpan('Root', () => {
          trace.withSpan('ShortPath', () => {});
          trace.withSpan('LongPath', () => {
            trace.withSpan('SubPath', () => {});
          });
        });

        const criticalPath = trace.getCriticalPath();
        expect(criticalPath).toEqual(['Root', 'LongPath', 'SubPath']);
      });
    });

    describe('getSpans', () => {
      it('should return all spans', () => {
        trace.withSpan('Op1', () => {
          trace.withSpan('Op2', () => {});
        });
        trace.withSpan('Op3', () => {});

        const spans = trace.getSpans();
        expect(spans).toHaveLength(3);
        expect(spans.map((s) => s.operation)).toContain('Op1');
        expect(spans.map((s) => s.operation)).toContain('Op2');
        expect(spans.map((s) => s.operation)).toContain('Op3');
      });
    });
  });

  describe('complex scenarios', () => {
    let trace;

    beforeEach(() => {
      trace = new StructuredTrace();
    });

    it('should handle deeply nested spans', () => {
      const depth = 10;
      const executeNested = (level) => {
        if (level <= depth) {
          trace.withSpan(`Level${level}`, () => {
            executeNested(level + 1);
          });
        }
      };

      trace.withSpan('Root', () => {
        executeNested(1);
      });

      const spans = trace.getSpans();
      expect(spans).toHaveLength(depth + 1);

      const criticalPath = trace.getCriticalPath();
      expect(criticalPath).toHaveLength(depth + 1);
    });

    it('should handle mixed sync and async operations', async () => {
      await trace.withSpanAsync('AsyncRoot', async () => {
        trace.withSpan('SyncChild1', () => {});

        await trace.withSpanAsync('AsyncChild', async () => {
          trace.withSpan('SyncGrandchild', () => {});
        });

        trace.withSpan('SyncChild2', () => {});
      });

      const view = trace.getHierarchicalView();
      expect(view.operation).toBe('AsyncRoot');
      expect(view.children).toHaveLength(3);
    });

    it('should maintain trace context alongside spans', async () => {
      await trace.withSpanAsync('Operation', async () => {
        trace.info('Starting operation', 'test');
        trace.step('Processing', 'test');
        trace.success('Completed', 'test');
      });

      expect(trace.logs).toHaveLength(3);
      expect(trace.getSpans()).toHaveLength(1);
    });
  });
});
