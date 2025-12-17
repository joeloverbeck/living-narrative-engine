/**
 * @file Unit tests for ConflictDetector
 * @see src/modManager/logic/ConflictDetector.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ConflictDetector } from '../../../../src/modManager/logic/ConflictDetector.js';

describe('ConflictDetector', () => {
  /** @type {jest.Mocked<{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}>} */
  let mockLogger;
  /** @type {ConflictDetector} */
  let detector;

  /**
   * Create mock mods for testing
   * @returns {Array<{id: string, name: string, version: string, description: string, author: string, dependencies: Array<{id: string, version: string}>, conflicts: string[], incompatibleVersions?: Record<string, string[]>}>}
   */
  const createMockMods = () => [
    {
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      description: 'Core mod',
      author: 'System',
      dependencies: [],
      conflicts: [],
    },
    {
      id: 'mod_a',
      name: 'Mod A',
      version: '1.0.0',
      description: 'Mod A',
      author: 'Author',
      dependencies: [{ id: 'core', version: '*' }],
      conflicts: ['mod_b'], // Declares conflict with mod_b
    },
    {
      id: 'mod_b',
      name: 'Mod B',
      version: '2.0.0',
      description: 'Mod B',
      author: 'Author',
      dependencies: [{ id: 'core', version: '*' }],
      conflicts: [],
    },
    {
      id: 'mod_c',
      name: 'Mod C',
      version: '1.5.0',
      description: 'Mod C',
      author: 'Author',
      dependencies: [{ id: 'core', version: '*' }],
      conflicts: [],
    },
    {
      id: 'mod_d',
      name: 'Mod D',
      version: '3.0.0',
      description: 'Mod D with version conflicts',
      author: 'Author',
      dependencies: [{ id: 'core', version: '*' }],
      conflicts: [],
      incompatibleVersions: {
        mod_b: ['2.0.0'], // Exact version conflict
        mod_c: ['1.x'], // Wildcard conflict
      },
    },
  ];

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    detector = new ConflictDetector({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => new ConflictDetector({})).toThrow(
        'ConflictDetector: logger is required'
      );
    });

    it('should create instance with logger', () => {
      expect(detector).toBeInstanceOf(ConflictDetector);
    });
  });

  describe('detectConflicts', () => {
    it('returns empty when no conflicts', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_c']);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.modConflicts.size).toBe(0);
    });

    it('finds declared conflicts', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        modA: 'mod_a',
        modB: 'mod_b',
        type: 'declared',
        reason: '"Mod A" declares incompatibility with "Mod B"',
      });
    });

    it('finds version conflicts with exact match', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_b', 'mod_d']);

      expect(result.hasConflicts).toBe(true);
      const versionConflict = result.conflicts.find(
        (c) => c.type === 'version' && c.modB === 'mod_b'
      );
      expect(versionConflict).toBeDefined();
      expect(versionConflict.reason).toContain('Mod D');
      expect(versionConflict.reason).toContain('Mod B');
      expect(versionConflict.reason).toContain('2.0.0');
    });

    it('finds version conflicts with wildcard pattern', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_c', 'mod_d']);

      expect(result.hasConflicts).toBe(true);
      const versionConflict = result.conflicts.find(
        (c) => c.type === 'version' && c.modB === 'mod_c'
      );
      expect(versionConflict).toBeDefined();
      expect(versionConflict.reason).toContain('Mod D');
      expect(versionConflict.reason).toContain('Mod C');
    });

    it('finds version conflicts with range pattern (>=)', () => {
      const mods = [
        ...createMockMods().filter((m) => m.id !== 'mod_d'),
        {
          id: 'mod_d',
          name: 'Mod D',
          version: '3.0.0',
          description: 'Mod D',
          author: 'Author',
          dependencies: [{ id: 'core', version: '*' }],
          conflicts: [],
          incompatibleVersions: {
            mod_b: ['>=2.0.0'], // Range conflict
          },
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_b', 'mod_d']);

      expect(result.hasConflicts).toBe(true);
      const versionConflict = result.conflicts.find((c) => c.type === 'version');
      expect(versionConflict).toBeDefined();
    });

    it('finds version conflicts with range pattern (<=)', () => {
      const mods = [
        ...createMockMods().filter((m) => m.id !== 'mod_d'),
        {
          id: 'mod_d',
          name: 'Mod D',
          version: '3.0.0',
          description: 'Mod D',
          author: 'Author',
          dependencies: [{ id: 'core', version: '*' }],
          conflicts: [],
          incompatibleVersions: {
            mod_c: ['<=2.0.0'], // mod_c is 1.5.0, should match
          },
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_c', 'mod_d']);

      expect(result.hasConflicts).toBe(true);
      const versionConflict = result.conflicts.find((c) => c.type === 'version');
      expect(versionConflict).toBeDefined();
    });

    it('deduplicates A-B and B-A conflicts', () => {
      // Create mods where both declare each other as conflicts
      const mods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core',
          author: 'System',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_x',
          name: 'Mod X',
          version: '1.0.0',
          description: 'Mod X',
          author: 'Author',
          dependencies: [],
          conflicts: ['mod_y'],
        },
        {
          id: 'mod_y',
          name: 'Mod Y',
          version: '1.0.0',
          description: 'Mod Y',
          author: 'Author',
          dependencies: [],
          conflicts: ['mod_x'],
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_x', 'mod_y']);

      expect(result.hasConflicts).toBe(true);
      // Should only have ONE conflict, not two
      expect(result.conflicts).toHaveLength(1);
    });

    it('builds modConflicts map correctly', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(result.modConflicts.get('mod_a')).toContain('mod_b');
      expect(result.modConflicts.get('mod_b')).toContain('mod_a');
    });

    it('logs warning when conflicts detected', () => {
      const mods = createMockMods();
      detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Detected'),
        expect.objectContaining({ conflicts: expect.any(Array) })
      );
    });

    it('handles missing mods gracefully', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'nonexistent_mod']);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('handles mods with empty conflicts array', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, ['core', 'mod_c']);

      expect(result.hasConflicts).toBe(false);
    });

    it('handles mods with undefined conflicts', () => {
      const mods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core',
          author: 'System',
          dependencies: [],
          // conflicts intentionally undefined
        },
      ];

      const result = detector.detectConflicts(mods, ['core']);

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('checkActivationConflicts', () => {
    it('returns only new mod conflicts', () => {
      const mods = createMockMods();
      // mod_a and mod_b are already active
      const result = detector.checkActivationConflicts('mod_a', mods, ['core', 'mod_b']);

      expect(result).toHaveLength(1);
      expect(result[0].modA).toBe('mod_a');
      expect(result[0].modB).toBe('mod_b');
    });

    it('returns empty for compatible mod', () => {
      const mods = createMockMods();
      const result = detector.checkActivationConflicts('mod_c', mods, ['core', 'mod_a']);

      expect(result).toHaveLength(0);
    });

    it('returns conflicts when new mod conflicts with existing', () => {
      const mods = createMockMods();
      // Try to activate mod_d which has version conflict with mod_b
      const result = detector.checkActivationConflicts('mod_d', mods, ['core', 'mod_b']);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((c) => c.modB === 'mod_b' && c.type === 'version')).toBe(true);
    });
  });

  describe('getConflictingMods', () => {
    it('returns conflicting mod IDs', () => {
      const mods = createMockMods();
      const result = detector.getConflictingMods('mod_a', mods, ['core', 'mod_a', 'mod_b']);

      expect(result).toContain('mod_b');
    });

    it('returns empty array when no conflicts', () => {
      const mods = createMockMods();
      const result = detector.getConflictingMods('mod_c', mods, ['core', 'mod_c']);

      expect(result).toEqual([]);
    });

    it('returns empty array for unknown mod', () => {
      const mods = createMockMods();
      const result = detector.getConflictingMods('unknown_mod', mods, ['core']);

      expect(result).toEqual([]);
    });
  });

  describe('getConflictWarning', () => {
    it('returns null for no conflicts', () => {
      const result = detector.getConflictWarning([]);
      expect(result).toBeNull();
    });

    it('returns single conflict message', () => {
      const conflicts = [
        {
          modA: 'mod_a',
          modB: 'mod_b',
          type: 'declared',
          reason: '"Mod A" declares incompatibility with "Mod B"',
        },
      ];

      const result = detector.getConflictWarning(conflicts);

      expect(result).toBe('"Mod A" declares incompatibility with "Mod B"');
    });

    it('returns multi-conflict summary', () => {
      const conflicts = [
        {
          modA: 'mod_a',
          modB: 'mod_b',
          type: 'declared',
          reason: 'Conflict 1',
        },
        {
          modA: 'mod_a',
          modB: 'mod_c',
          type: 'declared',
          reason: 'Conflict 2',
        },
      ];

      const result = detector.getConflictWarning(conflicts);

      expect(result).toContain('conflicts with 2 active mods');
      expect(result).toContain('mod_b');
      expect(result).toContain('mod_c');
    });
  });

  describe('version comparison (via isVersionIncompatible)', () => {
    it('handles semantic versions correctly', () => {
      const mods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core',
          author: 'System',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_a',
          name: 'Mod A',
          version: '2.10.3',
          description: 'Mod A',
          author: 'Author',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_b',
          name: 'Mod B',
          version: '1.0.0',
          description: 'Mod B',
          author: 'Author',
          dependencies: [],
          conflicts: [],
          incompatibleVersions: {
            mod_a: ['>=2.5.0'], // mod_a version 2.10.3 should match
          },
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(result.hasConflicts).toBe(true);
    });

    it('does not match non-incompatible versions', () => {
      const mods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core',
          author: 'System',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_a',
          name: 'Mod A',
          version: '1.0.0',
          description: 'Mod A',
          author: 'Author',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_b',
          name: 'Mod B',
          version: '1.0.0',
          description: 'Mod B',
          author: 'Author',
          dependencies: [],
          conflicts: [],
          incompatibleVersions: {
            mod_a: ['>=2.0.0'], // mod_a is 1.0.0, should NOT match
          },
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(result.hasConflicts).toBe(false);
    });

    it('handles versions with different part counts', () => {
      const mods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core',
          author: 'System',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_a',
          name: 'Mod A',
          version: '2.0',
          description: 'Mod A',
          author: 'Author',
          dependencies: [],
          conflicts: [],
        },
        {
          id: 'mod_b',
          name: 'Mod B',
          version: '1.0.0',
          description: 'Mod B',
          author: 'Author',
          dependencies: [],
          conflicts: [],
          incompatibleVersions: {
            mod_a: ['2.0.0'], // Should match 2.0 as 2.0.0
          },
        },
      ];

      const result = detector.detectConflicts(mods, ['core', 'mod_a', 'mod_b']);

      expect(result.hasConflicts).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty mods array', () => {
      const result = detector.detectConflicts([], ['mod_a']);
      expect(result.hasConflicts).toBe(false);
    });

    it('handles empty activeMods array', () => {
      const mods = createMockMods();
      const result = detector.detectConflicts(mods, []);
      expect(result.hasConflicts).toBe(false);
    });

    it('handles mod conflicting with itself gracefully', () => {
      const mods = [
        {
          id: 'mod_self',
          name: 'Self Conflict',
          version: '1.0.0',
          description: 'Mod',
          author: 'Author',
          dependencies: [],
          conflicts: ['mod_self'], // Edge case: conflicts with self
        },
      ];

      const result = detector.detectConflicts(mods, ['mod_self']);

      // Self-conflict should be detected
      expect(result.hasConflicts).toBe(true);
    });

    it('handles conflicting with non-existent mod', () => {
      const mods = [
        {
          id: 'mod_a',
          name: 'Mod A',
          version: '1.0.0',
          description: 'Mod A',
          author: 'Author',
          dependencies: [],
          conflicts: ['nonexistent'], // Conflicts with mod that doesn't exist
        },
      ];

      const result = detector.detectConflicts(mods, ['mod_a']);

      // No conflict because nonexistent is not in activeMods
      expect(result.hasConflicts).toBe(false);
    });
  });
});
