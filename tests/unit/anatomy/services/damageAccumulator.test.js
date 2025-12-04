/**
 * @file Unit tests for DamageAccumulator service.
 * @see src/anatomy/services/damageAccumulator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageAccumulator from '../../../../src/anatomy/services/damageAccumulator.js';

describe('DamageAccumulator', () => {
  let accumulator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    accumulator = new DamageAccumulator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(accumulator).toBeDefined();
    });
  });

  describe('createSession', () => {
    it('should create a session with the provided entityId', () => {
      const session = accumulator.createSession('entity-123');

      expect(session).toBeDefined();
      expect(session.entityId).toBe('entity-123');
      expect(session.entries).toEqual([]);
      expect(session.pendingEvents).toEqual([]);
      expect(session.sessionId).toMatch(/^damage_session_\d+_\d+$/);
      expect(session.createdAt).toBeDefined();
    });

    it('should create unique session IDs', () => {
      const session1 = accumulator.createSession('entity-1');
      const session2 = accumulator.createSession('entity-2');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should use "unknown" when entityId is not provided', () => {
      const session = accumulator.createSession(null);

      expect(session.entityId).toBe('unknown');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('createSession called without entityId')
      );
    });

    it('should log debug message on session creation', () => {
      accumulator.createSession('entity-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Created session')
      );
    });
  });

  describe('recordDamage', () => {
    it('should add damage entry to session', () => {
      const session = accumulator.createSession('entity-123');
      const entry = {
        entityId: 'entity-123',
        entityName: 'Test Entity',
        partId: 'part-1',
        partType: 'leg',
        orientation: 'left',
        amount: 25,
        damageType: 'slashing',
        propagatedFrom: null,
      };

      accumulator.recordDamage(session, entry);

      expect(session.entries).toHaveLength(1);
      expect(session.entries[0]).toMatchObject(entry);
      expect(session.entries[0].effectsTriggered).toEqual([]);
    });

    it('should preserve existing effectsTriggered array', () => {
      const session = accumulator.createSession('entity-123');
      const entry = {
        entityId: 'entity-123',
        partId: 'part-1',
        partType: 'arm',
        effectsTriggered: ['bleeding'],
      };

      accumulator.recordDamage(session, entry);

      expect(session.entries[0].effectsTriggered).toEqual(['bleeding']);
    });

    it('should log error when session is null', () => {
      accumulator.recordDamage(null, { entityId: 'test' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('recordDamage called without session')
      );
    });

    it('should log warning when entry is null', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.recordDamage(session, null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('recordDamage called without entry')
      );
      expect(session.entries).toHaveLength(0);
    });

    it('should log debug message with part info', () => {
      const session = accumulator.createSession('entity-123');
      const entry = {
        partType: 'head',
        propagatedFrom: null,
      };

      accumulator.recordDamage(session, entry);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Recorded damage to head')
      );
    });

    it('should indicate propagated damage in debug log', () => {
      const session = accumulator.createSession('entity-123');
      const entry = {
        partType: 'brain',
        propagatedFrom: 'head-part-id',
      };

      accumulator.recordDamage(session, entry);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('propagated: true')
      );
    });
  });

  describe('recordEffect', () => {
    it('should add effect to existing entry for part', () => {
      const session = accumulator.createSession('entity-123');
      accumulator.recordDamage(session, {
        partId: 'part-1',
        partType: 'leg',
        effectsTriggered: [],
      });

      accumulator.recordEffect(session, 'part-1', 'dismembered');

      expect(session.entries[0].effectsTriggered).toContain('dismembered');
    });

    it('should not add duplicate effects', () => {
      const session = accumulator.createSession('entity-123');
      accumulator.recordDamage(session, {
        partId: 'part-1',
        partType: 'leg',
        effectsTriggered: ['bleeding'],
      });

      accumulator.recordEffect(session, 'part-1', 'bleeding');

      expect(session.entries[0].effectsTriggered).toEqual(['bleeding']);
    });

    it('should log error when session is null', () => {
      accumulator.recordEffect(null, 'part-1', 'bleeding');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('recordEffect called without session')
      );
    });

    it('should log warning when partId is missing', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.recordEffect(session, null, 'bleeding');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('recordEffect called with missing partId or effect')
      );
    });

    it('should log warning when effect is missing', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.recordEffect(session, 'part-1', null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('recordEffect called with missing partId or effect')
      );
    });

    it('should log warning when entry for partId not found', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.recordEffect(session, 'nonexistent-part', 'bleeding');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find entry for partId')
      );
    });
  });

  describe('queueEvent', () => {
    it('should add event to pendingEvents', () => {
      const session = accumulator.createSession('entity-123');
      const payload = { entityId: 'entity-123', partType: 'arm' };

      accumulator.queueEvent(session, 'anatomy:damage_applied', payload);

      expect(session.pendingEvents).toHaveLength(1);
      expect(session.pendingEvents[0]).toEqual({
        eventType: 'anatomy:damage_applied',
        payload,
      });
    });

    it('should use empty object when payload is null', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.queueEvent(session, 'test:event', null);

      expect(session.pendingEvents[0].payload).toEqual({});
    });

    it('should log error when session is null', () => {
      accumulator.queueEvent(null, 'test:event', {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('queueEvent called without session')
      );
    });

    it('should log warning when eventType is missing', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.queueEvent(session, null, {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('queueEvent called without eventType')
      );
      expect(session.pendingEvents).toHaveLength(0);
    });
  });

  describe('finalize', () => {
    it('should return accumulated entries and pending events', () => {
      const session = accumulator.createSession('entity-123');
      const entry = { partId: 'part-1', partType: 'leg', effectsTriggered: [] };
      accumulator.recordDamage(session, entry);
      accumulator.queueEvent(session, 'test:event', { data: 'test' });

      const result = accumulator.finalize(session);

      expect(result.entries).toHaveLength(1);
      expect(result.pendingEvents).toHaveLength(1);
    });

    it('should return copies of arrays', () => {
      const session = accumulator.createSession('entity-123');
      accumulator.recordDamage(session, { partId: 'part-1', effectsTriggered: [] });

      const result = accumulator.finalize(session);

      // Modify the returned arrays
      result.entries.push({ fake: true });
      result.pendingEvents.push({ fake: true });

      // Original session should be unaffected
      expect(session.entries).toHaveLength(1);
      expect(session.pendingEvents).toHaveLength(0);
    });

    it('should return empty arrays when session is null', () => {
      const result = accumulator.finalize(null);

      expect(result.entries).toEqual([]);
      expect(result.pendingEvents).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('finalize called without session')
      );
    });

    it('should log session duration', () => {
      const session = accumulator.createSession('entity-123');

      accumulator.finalize(session);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Finalizing session')
      );
    });
  });

  describe('hasEntries', () => {
    it('should return false for new session', () => {
      const session = accumulator.createSession('entity-123');

      expect(accumulator.hasEntries(session)).toBe(false);
    });

    it('should return true after recording damage', () => {
      const session = accumulator.createSession('entity-123');
      accumulator.recordDamage(session, { partId: 'part-1', effectsTriggered: [] });

      expect(accumulator.hasEntries(session)).toBe(true);
    });

    it('should return falsy for null session', () => {
      expect(accumulator.hasEntries(null)).toBeFalsy();
    });

    it('should return falsy for session with null entries', () => {
      const session = { entries: null };

      expect(accumulator.hasEntries(session)).toBeFalsy();
    });
  });

  describe('getPrimaryEntry', () => {
    it('should return the non-propagated entry', () => {
      const session = accumulator.createSession('entity-123');
      const primaryEntry = {
        partId: 'head',
        partType: 'head',
        propagatedFrom: null,
        effectsTriggered: [],
      };
      const propagatedEntry = {
        partId: 'brain',
        partType: 'brain',
        propagatedFrom: 'head',
        effectsTriggered: [],
      };

      accumulator.recordDamage(session, primaryEntry);
      accumulator.recordDamage(session, propagatedEntry);

      const result = accumulator.getPrimaryEntry(session);

      expect(result.partId).toBe('head');
      expect(result.propagatedFrom).toBeNull();
    });

    it('should return null when no entries', () => {
      const session = accumulator.createSession('entity-123');

      expect(accumulator.getPrimaryEntry(session)).toBeNull();
    });

    it('should return null for null session', () => {
      expect(accumulator.getPrimaryEntry(null)).toBeNull();
    });

    it('should return null when all entries are propagated', () => {
      const session = accumulator.createSession('entity-123');
      accumulator.recordDamage(session, {
        partId: 'brain',
        partType: 'brain',
        propagatedFrom: 'head',
        effectsTriggered: [],
      });

      expect(accumulator.getPrimaryEntry(session)).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete damage sequence with propagation', () => {
      const session = accumulator.createSession('entity-123');

      // Record primary damage
      accumulator.recordDamage(session, {
        entityId: 'entity-123',
        entityName: 'Rill',
        entityPronoun: 'she',
        entityPossessive: 'her',
        partId: 'head-part-id',
        partType: 'head',
        orientation: null,
        amount: 30,
        damageType: 'piercing',
        propagatedFrom: null,
        effectsTriggered: [],
      });

      // Record propagated damage to brain
      accumulator.recordDamage(session, {
        entityId: 'entity-123',
        entityName: 'Rill',
        entityPronoun: 'she',
        entityPossessive: 'her',
        partId: 'brain-part-id',
        partType: 'brain',
        orientation: null,
        amount: 15,
        damageType: 'piercing',
        propagatedFrom: 'head-part-id',
        effectsTriggered: [],
      });

      // Record propagated damage to left eye
      accumulator.recordDamage(session, {
        entityId: 'entity-123',
        entityName: 'Rill',
        entityPronoun: 'she',
        entityPossessive: 'her',
        partId: 'left-eye-part-id',
        partType: 'eye',
        orientation: 'left',
        amount: 10,
        damageType: 'piercing',
        propagatedFrom: 'head-part-id',
        effectsTriggered: [],
      });

      // Record effect on primary
      accumulator.recordEffect(session, 'head-part-id', 'bleeding');

      // Queue backwards-compatible events
      accumulator.queueEvent(session, 'anatomy:damage_applied', {
        entityId: 'entity-123',
        partId: 'head-part-id',
      });

      // Finalize
      const result = accumulator.finalize(session);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].effectsTriggered).toContain('bleeding');
      expect(result.pendingEvents).toHaveLength(1);

      const primary = accumulator.getPrimaryEntry(session);
      expect(primary.partType).toBe('head');
    });
  });
});
