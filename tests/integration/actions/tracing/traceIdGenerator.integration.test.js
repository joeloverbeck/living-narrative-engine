import { describe, it, expect } from '@jest/globals';
import {
  TraceIdGenerator,
  NamingStrategy,
  TimestampFormat,
} from '../../../../src/actions/tracing/traceIdGenerator.js';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

class TestLogger {
  constructor() {
    this.records = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.records.debug.push(args);
  }

  info(...args) {
    this.records.info.push(args);
  }

  warn(...args) {
    this.records.warn.push(args);
  }

  error(...args) {
    this.records.error.push(args);
  }
}

class InMemoryStorageAdapter {
  constructor() {
    this.store = new Map();
  }

  async getItem(key) {
    if (!this.store.has(key)) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(this.store.get(key)));
  }

  async setItem(key, value) {
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async removeItem(key) {
    this.store.delete(key);
  }

  async getAllKeys() {
    return Array.from(this.store.keys());
  }
}

const createActionTrace = ({ logger, actionId, tracedPatterns }) => {
  const filter = new ActionTraceFilter({
    tracedActions: tracedPatterns,
    logger,
  });

  const trace = new ActionAwareStructuredTrace({
    actionTraceFilter: filter,
    actorId: 'actor-1',
    context: { scenario: 'trace-id-generator' },
    logger,
  });

  trace.captureActionData('component_filtering', actionId, {
    stage: 'component_filtering',
    passed: true,
  });

  return trace;
};

describe('TraceIdGenerator integration', () => {
  it('generates timestamp-first IDs with sanitized action identifiers and error flag', () => {
    const logger = new TestLogger();
    const trace = createActionTrace({
      logger,
      actionId: 'movement:go',
      tracedPatterns: ['movement:*'],
    });

    trace.execution = { error: new Error('synthetic failure') };

    const generator = new TraceIdGenerator();
    const id = generator.generateId(trace);

    expect(id).toMatch(/^[0-9]{8}_[0-9]{6}_movement-go_ERROR_[0-9a-f]{6}$/);
  });

  it('supports action-first strategy and human-readable timestamps when falling back to traced actions', () => {
    const logger = new TestLogger();
    const trace = createActionTrace({
      logger,
      actionId: 'core:look',
      tracedPatterns: ['core:*'],
    });

    const generator = new TraceIdGenerator({
      strategy: NamingStrategy.ACTION_FIRST,
      timestampFormat: TimestampFormat.HUMAN,
      includeHash: false,
    });

    const id = generator.generateId(trace);

    expect(id).toMatch(
      /^core-look_[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}h[0-9]{2}m[0-9]{2}s(?:_ERROR)?$/
    );
  });

  it('resets sequential counters to reuse identifiers deterministically', () => {
    const logger = new TestLogger();
    const trace = createActionTrace({
      logger,
      actionId: 'movement:go',
      tracedPatterns: ['movement:*'],
    });

    const generator = new TraceIdGenerator({
      strategy: NamingStrategy.SEQUENTIAL,
      timestampFormat: TimestampFormat.UNIX,
      includeHash: false,
    });

    const first = generator.generateId(trace);
    const second = generator.generateId(trace);
    expect(first).toMatch(/^trace_000001_movement-go_[0-9]+(?:_ERROR)?$/);
    expect(second).toMatch(/^trace_000002_movement-go_[0-9]+(?:_ERROR)?$/);
    expect(first).not.toBe(second);

    generator.resetSequence();
    const reset = generator.generateId(trace);
    expect(reset).toMatch(/^trace_000001_movement-go_[0-9]+(?:_ERROR)?$/);
  });

  it('coordinates with TraceQueueProcessor to assign sequential IDs across stored traces', async () => {
    const logger = new TestLogger();
    const storageAdapter = new InMemoryStorageAdapter();
    const timerService = new TestTimerService();

    const processor = new TraceQueueProcessor({
      storageAdapter,
      logger,
      timerService,
      config: {
        batchSize: 2,
        batchTimeout: 5,
        storageKey: 'traceQueueIntegration',
        enableParallelProcessing: false,
        maxStoredTraces: 10,
      },
      namingOptions: {
        strategy: NamingStrategy.SEQUENTIAL,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      },
    });

    try {
      const traceA = createActionTrace({
        logger,
        actionId: 'movement:go',
        tracedPatterns: ['movement:*'],
      });
      const traceB = createActionTrace({
        logger,
        actionId: 'core:look',
        tracedPatterns: ['core:*'],
      });

      expect(processor.enqueue(traceA)).toBe(true);
      expect(processor.enqueue(traceB)).toBe(true);

      await timerService.triggerAll();
      await processor.shutdown();

      const stored = await storageAdapter.getItem('traceQueueIntegration');
      expect(stored).toHaveLength(2);

      const ids = stored.map((entry) => entry.id);
      expect(ids[0]).toMatch(
        /^trace_000001_movement-go_[0-9]{8}_[0-9]{6}(?:_ERROR)?$/
      );
      expect(ids[1]).toMatch(
        /^trace_000002_core-look_[0-9]{8}_[0-9]{6}(?:_ERROR)?$/
      );
    } finally {
      await processor.shutdown();
    }
  });
});
