/**
 * @file Unit tests for StateDiffViewer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import StateDiffViewer from '../../../../src/goap/debug/stateDiffViewer.js';

describe('StateDiffViewer', () => {
  let testBed;
  let viewer;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    viewer = new StateDiffViewer({ logger: mockLogger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create instance with valid logger', () => {
      expect(viewer).toBeDefined();
    });

    it('should create instance with fallback logger when logger is missing', () => {
      const viewerWithoutLogger = new StateDiffViewer({});
      expect(viewerWithoutLogger).toBeDefined();
    });

    it('should create instance with fallback logger when logger is invalid', () => {
      const viewerWithInvalidLogger = new StateDiffViewer({ logger: {} });
      expect(viewerWithInvalidLogger).toBeDefined();
    });
  });

  describe('diff() - Added Facts', () => {
    it('should detect simple added fact', () => {
      const before = {};
      const after = { 'actor-1:core:hungry': {} };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({ 'actor-1:core:hungry': {} });
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});
    });

    it('should detect added fact with data', () => {
      const before = {};
      const after = { 'actor-1:core:hungry': { level: 50 } };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({ 'actor-1:core:hungry': { level: 50 } });
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});
    });

    it('should detect multiple added facts', () => {
      const before = { 'actor-1:core:exists': true };
      const after = {
        'actor-1:core:exists': true,
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:tired': {},
      };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:tired': {},
      });
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});
    });

    it('should detect added boolean fact', () => {
      const before = {};
      const after = { 'food-1:core:exists': true };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({ 'food-1:core:exists': true });
    });

    it('should detect added component field', () => {
      const before = {};
      const after = { 'actor-1:core:actor:health': 100 };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({ 'actor-1:core:actor:health': 100 });
    });
  });

  describe('diff() - Modified Facts', () => {
    it('should detect simple value modification', () => {
      const before = { 'actor-1:core:actor:health': 100 };
      const after = { 'actor-1:core:actor:health': 75 };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:actor:health',
          before: 100,
          after: 75,
        },
      ]);
      expect(diff.removed).toEqual({});
    });

    it('should detect object modification', () => {
      const before = { 'actor-1:core:hungry': { level: 50 } };
      const after = { 'actor-1:core:hungry': { level: 25 } };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:hungry',
          before: { level: 50 },
          after: { level: 25 },
        },
      ]);
    });

    it('should detect empty object to data object change', () => {
      const before = { 'actor-1:core:hungry': {} };
      const after = { 'actor-1:core:hungry': { level: 50 } };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:hungry',
          before: {},
          after: { level: 50 },
        },
      ]);
    });

    it('should detect data object to empty object change', () => {
      const before = { 'actor-1:core:hungry': { level: 50 } };
      const after = { 'actor-1:core:hungry': {} };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:hungry',
          before: { level: 50 },
          after: {},
        },
      ]);
    });

    it('should detect boolean to object change', () => {
      const before = { 'actor-1:core:exists': true };
      const after = { 'actor-1:core:exists': {} };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:exists',
          before: true,
          after: {},
        },
      ]);
    });

    it('should detect multiple modifications', () => {
      const before = {
        'actor-1:core:actor:health': 100,
        'actor-1:core:hungry': { level: 50 },
      };
      const after = {
        'actor-1:core:actor:health': 75,
        'actor-1:core:hungry': { level: 25 },
      };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toHaveLength(2);
      expect(diff.modified).toContainEqual({
        key: 'actor-1:core:actor:health',
        before: 100,
        after: 75,
      });
      expect(diff.modified).toContainEqual({
        key: 'actor-1:core:hungry',
        before: { level: 50 },
        after: { level: 25 },
      });
    });

    it('should not detect identical nested objects as modified', () => {
      const before = { 'actor-1:core:hungry': { level: 50, status: 'moderate' } };
      const after = { 'actor-1:core:hungry': { level: 50, status: 'moderate' } };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([]);
    });
  });

  describe('diff() - Removed Facts', () => {
    it('should detect simple removed fact', () => {
      const before = { 'actor-1:core:hungry': {} };
      const after = {};

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({ 'actor-1:core:hungry': {} });
    });

    it('should detect removed fact with data', () => {
      const before = { 'actor-1:core:hungry': { level: 50 } };
      const after = {};

      const diff = viewer.diff(before, after);

      expect(diff.removed).toEqual({ 'actor-1:core:hungry': { level: 50 } });
    });

    it('should detect multiple removed facts', () => {
      const before = {
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:tired': {},
        'actor-1:core:exists': true,
      };
      const after = { 'actor-1:core:exists': true };

      const diff = viewer.diff(before, after);

      expect(diff.removed).toEqual({
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:tired': {},
      });
    });
  });

  describe('diff() - No Changes', () => {
    it('should return empty diff for identical states', () => {
      const state = { 'actor-1:core:hungry': { level: 50 } };

      const diff = viewer.diff(state, state);

      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});
    });

    it('should return empty diff for empty states', () => {
      const diff = viewer.diff({}, {});

      expect(diff.added).toEqual({});
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual({});
    });

    it('should handle identical complex states', () => {
      const state = {
        'actor-1:core:hungry': { level: 50, status: 'moderate' },
        'actor-1:core:exists': true,
        'food-1:core:exists': {},
      };

      const diff = viewer.diff(state, state);

      expect(diff.modified).toEqual([]);
    });
  });

  describe('diff() - Complex Changes', () => {
    it('should handle simultaneous add, modify, and remove', () => {
      const before = {
        'actor-1:core:hungry': { level: 50 },
        'actor-1:core:exists': true,
        'food-1:core:exists': true,
      };
      const after = {
        'actor-1:core:hungry': { level: 25 },
        'actor-1:core:satiated': {},
        'food-1:core:exists': true,
      };

      const diff = viewer.diff(before, after);

      expect(diff.added).toEqual({ 'actor-1:core:satiated': {} });
      expect(diff.modified).toEqual([
        {
          key: 'actor-1:core:hungry',
          before: { level: 50 },
          after: { level: 25 },
        },
      ]);
      expect(diff.removed).toEqual({ 'actor-1:core:exists': true });
    });

    it('should handle nested object changes', () => {
      const before = {
        'actor-1:core:inventory': { items: ['sword', 'shield'], weight: 10 },
      };
      const after = {
        'actor-1:core:inventory': { items: ['sword', 'shield', 'potion'], weight: 11 },
      };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].key).toBe('actor-1:core:inventory');
    });

    it('should handle array changes', () => {
      const before = { 'actor-1:core:tags': ['hungry', 'tired'] };
      const after = { 'actor-1:core:tags': ['tired', 'rested'] };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toHaveLength(1);
    });
  });

  describe('diff() - Deep Equality Edge Cases', () => {
    it('should handle null values', () => {
      const before = { 'actor-1:core:data': null };
      const after = { 'actor-1:core:data': null };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([]);
    });

    it('should detect null to value change', () => {
      const before = { 'actor-1:core:data': null };
      const after = { 'actor-1:core:data': 100 };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toHaveLength(1);
    });

    it('should handle undefined values', () => {
      const before = { 'actor-1:core:data': undefined };
      const after = { 'actor-1:core:data': undefined };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toEqual([]);
    });

    it('should detect deeply nested object differences', () => {
      const before = {
        'actor-1:core:stats': {
          physical: { strength: 10, dexterity: 8 },
          mental: { intelligence: 12 },
        },
      };
      const after = {
        'actor-1:core:stats': {
          physical: { strength: 10, dexterity: 9 },
          mental: { intelligence: 12 },
        },
      };

      const diff = viewer.diff(before, after);

      expect(diff.modified).toHaveLength(1);
    });
  });

  describe('visualize() - Text Formatting', () => {
    it('should format added facts', () => {
      const diff = {
        added: { 'actor-1:core:hungry': { level: 50 } },
        modified: [],
        removed: {},
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('Changes: 1 total (1 added, 0 modified, 0 removed)');
      expect(output).toContain('ADDED:');
      expect(output).toContain('+ actor-1:core:hungry:');
    });

    it('should format modified facts', () => {
      const diff = {
        added: {},
        modified: [
          {
            key: 'actor-1:core:actor:health',
            before: 100,
            after: 75,
          },
        ],
        removed: {},
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('MODIFIED:');
      expect(output).toContain('~ actor-1:core:actor:health:');
      expect(output).toContain('before: 100');
      expect(output).toContain('after:  75');
    });

    it('should format removed facts', () => {
      const diff = {
        added: {},
        modified: [],
        removed: { 'actor-1:core:hungry': {} },
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('REMOVED:');
      expect(output).toContain('- actor-1:core:hungry: {}');
    });

    it('should include task information when provided', () => {
      const diff = {
        added: { 'actor-1:core:satiated': {} },
        modified: [],
        removed: {},
      };

      const output = viewer.visualize(diff, {
        taskName: 'eat_food',
        stepNumber: 3,
      });

      expect(output).toContain('=== Step 3 - Task: eat_food ===');
    });

    it('should handle no changes gracefully', () => {
      const diff = {
        added: {},
        modified: [],
        removed: {},
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('Changes: 0 total (0 added, 0 modified, 0 removed)');
      expect(output).toContain('No state changes detected.');
    });

    it('should format complex changes', () => {
      const diff = {
        added: { 'actor-1:core:satiated': {} },
        modified: [
          {
            key: 'actor-1:core:hungry',
            before: { level: 50 },
            after: { level: 25 },
          },
        ],
        removed: { 'food-1:core:exists': true },
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('Changes: 3 total (1 added, 1 modified, 1 removed)');
      expect(output).toContain('ADDED:');
      expect(output).toContain('MODIFIED:');
      expect(output).toContain('REMOVED:');
    });

    it('should format different value types correctly', () => {
      const diff = {
        added: {
          'actor-1:core:name': 'John',
          'actor-1:core:health': 100,
          'actor-1:core:alive': true,
          'actor-1:core:data': null,
          'actor-1:core:items': ['sword', 'shield'],
          'actor-1:core:empty': {},
        },
        modified: [],
        removed: {},
      };

      const output = viewer.visualize(diff);

      expect(output).toContain('"John"');
      expect(output).toContain('100');
      expect(output).toContain('true');
      expect(output).toContain('null');
      expect(output).toContain('["sword","shield"]');
      expect(output).toContain('{}');
    });
  });

  describe('diffJSON() - JSON Output', () => {
    it('should generate JSON with summary', () => {
      const before = { 'actor-1:core:hungry': { level: 50 } };
      const after = { 'actor-1:core:satiated': {} };

      const json = viewer.diffJSON(before, after);

      expect(json.summary).toEqual({
        totalChanges: 2,
        added: 1,
        modified: 0,
        removed: 1,
      });
    });

    it('should include changes in JSON', () => {
      const before = { 'actor-1:core:hungry': { level: 50 } };
      const after = { 'actor-1:core:hungry': { level: 25 } };

      const json = viewer.diffJSON(before, after);

      expect(json.changes.added).toEqual({});
      expect(json.changes.modified).toHaveLength(1);
      expect(json.changes.removed).toEqual({});
    });

    it('should include optional metadata', () => {
      const before = {};
      const after = { 'actor-1:core:satiated': {} };

      const json = viewer.diffJSON(before, after, {
        taskName: 'eat_food',
        stepNumber: 3,
      });

      expect(json.taskName).toBe('eat_food');
      expect(json.stepNumber).toBe(3);
    });

    it('should handle no changes in JSON', () => {
      const state = { 'actor-1:core:exists': true };

      const json = viewer.diffJSON(state, state);

      expect(json.summary.totalChanges).toBe(0);
      expect(json.changes.added).toEqual({});
      expect(json.changes.modified).toEqual([]);
      expect(json.changes.removed).toEqual({});
    });
  });
});
