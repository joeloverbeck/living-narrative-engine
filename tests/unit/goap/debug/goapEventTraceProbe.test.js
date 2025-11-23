/**
 * @file Unit tests for goapEventTraceProbe.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createGoapEventTraceProbe } from '../../../../src/goap/debug/goapEventTraceProbe.js';

describe('goapEventTraceProbe', () => {
  let probe;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('createGoapEventTraceProbe - initialization', () => {
    it('should create probe with default options', () => {
      probe = createGoapEventTraceProbe();
      expect(probe).toBeDefined();
      expect(probe.record).toBeInstanceOf(Function);
      expect(probe.startCapture).toBeInstanceOf(Function);
      expect(probe.stopCapture).toBeInstanceOf(Function);
    });

    it('should create probe with custom options', () => {
      probe = createGoapEventTraceProbe({
        maxEventsPerActor: 50,
        maxGlobalEvents: 200,
        logger: mockLogger,
      });
      expect(probe).toBeDefined();
    });

    it('should create probe without logger', () => {
      probe = createGoapEventTraceProbe({});
      expect(probe).toBeDefined();
    });
  });

  describe('normalizeActorId behavior', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should normalize valid string actor ID', () => {
      probe.startCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(true);
    });

    it('should normalize actor ID with whitespace', () => {
      probe.startCapture('  actor1  ');
      expect(probe.isCapturing('actor1')).toBe(true);
    });

    it('should treat empty string as global', () => {
      probe.startCapture('');
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should treat whitespace-only string as global', () => {
      probe.startCapture('   ');
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should treat non-string as global', () => {
      probe.startCapture(null);
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should treat undefined as global', () => {
      probe.startCapture(undefined);
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should treat number as global', () => {
      probe.startCapture(123);
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should treat object as global', () => {
      probe.startCapture({});
      expect(probe.isCapturing('global')).toBe(true);
    });
  });

  describe('clonePayload behavior', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
      probe.startCapture('actor1');
    });

    it('should handle null payload', () => {
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: null,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual({});
    });

    it('should handle undefined payload', () => {
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: undefined,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual({});
    });

    it('should handle non-object payload (string)', () => {
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: 'string',
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual({});
    });

    it('should handle non-object payload (number)', () => {
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: 123,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual({});
    });

    it('should clone valid object payload with structuredClone', () => {
      const payload = { key: 'value', nested: { data: 'test' } };
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual(payload);
      expect(events[0].payload).not.toBe(payload);
    });

    it('should fallback to JSON serialization when structuredClone fails', () => {
      // Create a circular reference that will fail structuredClone
      const payload = { key: 'value' };
      payload.circular = payload;

      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload,
      });
      const events = probe.getEvents('actor1');
      // JSON serialization will also fail with circular, so it falls back to spread
      expect(events[0].payload).toBeDefined();
    });

    it('should use spread operator when JSON serialization fails', () => {
      // Mock structuredClone to not exist
      const originalStructuredClone = global.structuredClone;
      global.structuredClone = undefined;

      // Create object with toJSON that throws
      const payload = {
        key: 'value',
        toJSON() {
          throw new Error('JSON serialization failed');
        },
      };

      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toHaveProperty('key', 'value');

      // Restore structuredClone
      global.structuredClone = originalStructuredClone;
    });

    it('should use JSON serialization when structuredClone is not available', () => {
      // Mock structuredClone to not exist
      const originalStructuredClone = global.structuredClone;
      global.structuredClone = undefined;

      const payload = { key: 'value', nested: { data: 'test' } };
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].payload).toEqual(payload);
      expect(events[0].payload).not.toBe(payload);

      // Restore structuredClone
      global.structuredClone = originalStructuredClone;
    });
  });

  describe('startCapture', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should enable capture for specific actor', () => {
      probe.startCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GOAP event trace capture enabled for actor1'
      );
    });

    it('should enable capture for global actor', () => {
      probe.startCapture('global');
      expect(probe.isCapturing('global')).toBe(true);
    });

    it('should enable capture for multiple actors', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');
      expect(probe.isCapturing('actor1')).toBe(true);
      expect(probe.isCapturing('actor2')).toBe(true);
    });

    it('should set attachedAtLeastOnce flag', () => {
      probe.startCapture('actor1');
      const totals = probe.getTotals();
      expect(totals.attachedAtLeastOnce).toBe(true);
    });
  });

  describe('stopCapture', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should disable capture for active actor', () => {
      probe.startCapture('actor1');
      probe.stopCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GOAP event trace capture disabled for actor1'
      );
    });

    it('should not log when stopping inactive actor', () => {
      mockLogger.debug.mockClear();
      probe.stopCapture('actor1');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('disabled')
      );
    });

    it('should handle stopping global capture', () => {
      probe.startCapture('global');
      probe.stopCapture('global');
      expect(probe.isCapturing('global')).toBe(false);
    });
  });

  describe('record', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should not record events when no actors are capturing', () => {
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: { data: 'test' },
      });
      const events = probe.getEvents('actor1');
      expect(events).toEqual([]);
    });

    it('should record events for specific actor', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: { data: 'test' },
      });
      const events = probe.getEvents('actor1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEST_EVENT');
    });

    it('should record events for global capture', () => {
      probe.startCapture('global');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: { data: 'test' },
      });
      const events = probe.getEvents('global');
      expect(events).toHaveLength(1);
    });

    it('should record events for both specific and global capture', () => {
      probe.startCapture('actor1');
      probe.startCapture('global');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: { data: 'test' },
      });
      expect(probe.getEvents('actor1')).toHaveLength(1);
      expect(probe.getEvents('global')).toHaveLength(1);
    });

    it('should add timestamp if not provided', () => {
      probe.startCapture('actor1');
      const beforeTime = Date.now();
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
      });
      const afterTime = Date.now();
      const events = probe.getEvents('actor1');
      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve provided timestamp', () => {
      probe.startCapture('actor1');
      const customTimestamp = 1234567890;
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
        timestamp: customTimestamp,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].timestamp).toBe(customTimestamp);
    });

    it('should track violation flag', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
        violation: true,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].violation).toBe(true);
    });

    it('should increment violation counts for actor and global', () => {
      probe.startCapture('actor1');
      probe.startCapture('global');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
        violation: true,
      });
      const snapshot1 = probe.getSnapshot('actor1');
      const snapshotGlobal = probe.getSnapshot('global');
      expect(snapshot1.totalViolations).toBe(1);
      expect(snapshotGlobal.globalViolations).toBe(1);
    });

    it('should track multiple violations', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'EVENT1',
        actorId: 'actor1',
        violation: true,
      });
      probe.record({
        type: 'EVENT2',
        actorId: 'actor1',
        violation: true,
      });
      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.totalViolations).toBe(2);
    });

    it('should handle violation as false', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
        violation: false,
      });
      const events = probe.getEvents('actor1');
      expect(events[0].violation).toBe(false);
    });

    it('should handle missing violation flag', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
      });
      const events = probe.getEvents('actor1');
      expect(events[0].violation).toBe(false);
    });

    it('should increment totalRecorded counter', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor1' });
      const totals = probe.getTotals();
      expect(totals.totalRecorded).toBe(2);
    });
  });

  describe('buffer limit enforcement', () => {
    it('should enforce maxEventsPerActor limit', () => {
      probe = createGoapEventTraceProbe({
        maxEventsPerActor: 3,
        logger: mockLogger,
      });
      probe.startCapture('actor1');

      for (let i = 0; i < 5; i++) {
        probe.record({
          type: `EVENT${i}`,
          actorId: 'actor1',
          payload: { index: i },
        });
      }

      const events = probe.getEvents('actor1');
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('EVENT2'); // First two were removed
      expect(events[2].type).toBe('EVENT4');
    });

    it('should enforce maxGlobalEvents limit', () => {
      probe = createGoapEventTraceProbe({
        maxGlobalEvents: 3,
        logger: mockLogger,
      });
      probe.startCapture('global');

      for (let i = 0; i < 5; i++) {
        probe.record({
          type: `EVENT${i}`,
          actorId: 'actor1',
          payload: { index: i },
        });
      }

      const events = probe.getEvents('global');
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('EVENT2');
    });
  });

  describe('getSnapshot', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({
        maxEventsPerActor: 100,
        maxGlobalEvents: 250,
        logger: mockLogger,
      });
    });

    it('should return snapshot for actor with events', () => {
      probe.startCapture('actor1');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        payload: {},
        timestamp: 1000,
      });

      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.actorId).toBe('actor1');
      expect(snapshot.capturing).toBe(true);
      expect(snapshot.bufferLimit).toBe(100);
      expect(snapshot.totalCaptured).toBe(1);
      expect(snapshot.lastEventTimestamp).toBe(1000);
      expect(snapshot.events).toHaveLength(1);
    });

    it('should return snapshot for global actor', () => {
      probe.startCapture('global');
      probe.record({
        type: 'TEST_EVENT',
        actorId: 'actor1',
        timestamp: 1000,
      });

      const snapshot = probe.getSnapshot('global');
      expect(snapshot.actorId).toBe('global');
      expect(snapshot.bufferLimit).toBe(250);
      expect(snapshot.totalCaptured).toBe(1);
    });

    it('should return empty snapshot for actor with no events', () => {
      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.actorId).toBe('actor1');
      expect(snapshot.capturing).toBe(false);
      expect(snapshot.totalCaptured).toBe(0);
      expect(snapshot.lastEventTimestamp).toBeNull();
      expect(snapshot.events).toEqual([]);
    });

    it('should include totalRecorded in snapshot', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor1' });

      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.totalRecorded).toBe(2);
    });

    it('should include violation counts in snapshot', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT2', actorId: 'actor1', violation: true });

      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.totalViolations).toBe(2);
    });

    it('should show zero violations when none recorded', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });

      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.totalViolations).toBe(0);
      expect(snapshot.globalViolations).toBe(0);
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should return events array for actor', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor1' });

      const events = probe.getEvents('actor1');
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('EVENT1');
      expect(events[1].type).toBe('EVENT2');
    });

    it('should return empty array for actor with no events', () => {
      const events = probe.getEvents('actor1');
      expect(events).toEqual([]);
    });

    it('should clone events (not return references)', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1', payload: { key: 'value' } });

      const events1 = probe.getEvents('actor1');
      const events2 = probe.getEvents('actor1');

      expect(events1).toEqual(events2);
      expect(events1).not.toBe(events2);
      expect(events1[0]).not.toBe(events2[0]);
    });
  });

  describe('flush', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should return and clear events for actor', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor1' });

      const flushed = probe.flush('actor1');
      expect(flushed).toHaveLength(2);

      const remaining = probe.getEvents('actor1');
      expect(remaining).toEqual([]);
    });

    it('should flush global events', () => {
      probe.startCapture('global');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });

      const flushed = probe.flush('global');
      expect(flushed).toHaveLength(1);

      const remaining = probe.getEvents('global');
      expect(remaining).toEqual([]);
    });

    it('should return empty array when flushing actor with no events', () => {
      const flushed = probe.flush('actor1');
      expect(flushed).toEqual([]);
    });

    it('should clone events when flushing', () => {
      probe.startCapture('actor1');
      const originalPayload = { key: 'value' };
      probe.record({
        type: 'EVENT1',
        actorId: 'actor1',
        payload: originalPayload,
      });

      const flushed = probe.flush('actor1');
      expect(flushed[0].payload).toEqual(originalPayload);
      expect(flushed[0].payload).not.toBe(originalPayload);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should clear events for specific actor', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT2', actorId: 'actor2' });

      probe.clear('actor1');

      expect(probe.getEvents('actor1')).toEqual([]);
      expect(probe.getEvents('actor2')).toHaveLength(1);
    });

    it('should clear violation counts for specific actor', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });

      probe.clear('actor1');

      const snapshot = probe.getSnapshot('actor1');
      expect(snapshot.totalViolations).toBe(0);
    });

    it('should clear global events when clearing global', () => {
      probe.startCapture('global');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });

      probe.clear('global');

      expect(probe.getEvents('global')).toEqual([]);
    });

    it('should clear all data when called without actorId', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');
      probe.startCapture('global');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT2', actorId: 'actor2' });

      probe.clear();

      expect(probe.getEvents('actor1')).toEqual([]);
      expect(probe.getEvents('actor2')).toEqual([]);
      expect(probe.getEvents('global')).toEqual([]);
      expect(probe.getActiveActors()).toEqual([]);
      expect(probe.isCapturing('actor1')).toBe(false);
      expect(probe.isCapturing('actor2')).toBe(false);
    });

    it('should reset totalRecorded when clearing all', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });

      probe.clear();

      const totals = probe.getTotals();
      expect(totals.totalRecorded).toBe(0);
    });

    it('should reset totalViolations when clearing all', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });

      probe.clear();

      const totals = probe.getTotals();
      expect(totals.totalViolations).toBe(0);
    });
  });

  describe('isCapturing', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should return false for inactive actor', () => {
      expect(probe.isCapturing('actor1')).toBe(false);
    });

    it('should return true for active actor', () => {
      probe.startCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(true);
    });

    it('should return false after stopping capture', () => {
      probe.startCapture('actor1');
      probe.stopCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(false);
    });
  });

  describe('getActiveActors', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should return empty array when no actors active', () => {
      expect(probe.getActiveActors()).toEqual([]);
    });

    it('should return array of active actors', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');
      const active = probe.getActiveActors();
      expect(active).toHaveLength(2);
      expect(active).toContain('actor1');
      expect(active).toContain('actor2');
    });

    it('should not include stopped actors', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');
      probe.stopCapture('actor1');
      const active = probe.getActiveActors();
      expect(active).toEqual(['actor2']);
    });
  });

  describe('getTotals', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({ logger: mockLogger });
    });

    it('should return initial totals', () => {
      const totals = probe.getTotals();
      expect(totals.totalRecorded).toBe(0);
      expect(totals.totalViolations).toBe(0);
      expect(totals.attachedAtLeastOnce).toBe(false);
    });

    it('should track totalRecorded', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor1' });

      const totals = probe.getTotals();
      expect(totals.totalRecorded).toBe(2);
    });

    it('should track totalViolations', () => {
      probe.startCapture('actor1');
      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT2', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT3', actorId: 'actor1', violation: false });

      const totals = probe.getTotals();
      expect(totals.totalViolations).toBe(2);
    });

    it('should set attachedAtLeastOnce after starting capture', () => {
      probe.startCapture('actor1');
      const totals = probe.getTotals();
      expect(totals.attachedAtLeastOnce).toBe(true);
    });

    it('should keep attachedAtLeastOnce true even after clearing', () => {
      probe.startCapture('actor1');
      probe.clear();
      const totals = probe.getTotals();
      expect(totals.attachedAtLeastOnce).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      probe = createGoapEventTraceProbe({
        maxEventsPerActor: 5,
        maxGlobalEvents: 10,
        logger: mockLogger,
      });
    });

    it('should handle multiple actors recording simultaneously', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');

      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor2' });
      probe.record({ type: 'EVENT3', actorId: 'actor1' });

      expect(probe.getEvents('actor1')).toHaveLength(2);
      expect(probe.getEvents('actor2')).toHaveLength(1);
    });

    it('should handle global capture alongside specific actors', () => {
      probe.startCapture('global');
      probe.startCapture('actor1');

      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      probe.record({ type: 'EVENT2', actorId: 'actor2' });

      expect(probe.getEvents('actor1')).toHaveLength(1);
      expect(probe.getEvents('global')).toHaveLength(2);
    });

    it('should maintain separate violation counts per actor', () => {
      probe.startCapture('actor1');
      probe.startCapture('actor2');

      probe.record({ type: 'EVENT1', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT2', actorId: 'actor1', violation: true });
      probe.record({ type: 'EVENT3', actorId: 'actor2', violation: true });

      const snapshot1 = probe.getSnapshot('actor1');
      const snapshot2 = probe.getSnapshot('actor2');

      expect(snapshot1.totalViolations).toBe(2);
      expect(snapshot2.totalViolations).toBe(1);
    });

    it('should handle complete lifecycle: start, record, flush, clear', () => {
      probe.startCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(true);

      probe.record({ type: 'EVENT1', actorId: 'actor1' });
      expect(probe.getEvents('actor1')).toHaveLength(1);

      const flushed = probe.flush('actor1');
      expect(flushed).toHaveLength(1);
      expect(probe.getEvents('actor1')).toHaveLength(0);

      probe.record({ type: 'EVENT2', actorId: 'actor1' });
      expect(probe.getEvents('actor1')).toHaveLength(1);

      probe.clear('actor1');
      expect(probe.getEvents('actor1')).toHaveLength(0);

      probe.stopCapture('actor1');
      expect(probe.isCapturing('actor1')).toBe(false);
    });
  });
});
