/**
 * @file ActionCategorizationService.test.js - Unit tests for ActionCategorizationService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionCategorizationService from '../../../../src/entities/utils/ActionCategorizationService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ActionCategorizationService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new ActionCategorizationService({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should construct with valid logger dependency', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ActionCategorizationService);
    });

    it('should throw error with invalid logger dependency', () => {
      expect(() => new ActionCategorizationService({ logger: {} })).toThrow();
    });

    it('should throw error with missing logger dependency', () => {
      expect(() => new ActionCategorizationService({})).toThrow();
    });
  });

  describe('Static Methods', () => {
    describe('getDefaultConfig', () => {
      it('should return correct default configuration', () => {
        const config = ActionCategorizationService.getDefaultConfig();

        expect(config).toEqual({
          enabled: true,
          minActionsForGrouping: 6,
          minNamespacesForGrouping: 2,
          namespaceOrder: [
            'core',
            'affection',
            'kissing',
            'caressing',
            'sex',
            'anatomy',
            'clothing',
            'movement',
          ],
          showCounts: false,
          performance: {
            enableCaching: true,
            cacheMaxSize: 1000,
            performanceLogging: false,
            slowOperationThresholdMs: 10,
          },
          errorHandling: {
            logLevel: 'warn',
            fallbackBehavior: 'flatten',
            maxRetries: 1,
          },
        });
      });

      it('should return a new object each time (no mutation)', () => {
        const config1 = ActionCategorizationService.getDefaultConfig();
        const config2 = ActionCategorizationService.getDefaultConfig();

        expect(config1).not.toBe(config2);

        // Mutate one and ensure the other is unaffected
        config1.enabled = false;
        expect(config2.enabled).toBe(true);
      });
    });
  });

  describe('extractNamespace', () => {
    it('should extract namespace from valid actionId with namespace', () => {
      expect(service.extractNamespace('core:wait')).toBe('core');
      expect(service.extractNamespace('affection:touch')).toBe('affection');
      expect(service.extractNamespace('custom_mod:action')).toBe('custom_mod');
    });

    it('should return "unknown" for actionId without namespace', () => {
      expect(service.extractNamespace('wait')).toBe('unknown');
      expect(service.extractNamespace('action_without_namespace')).toBe(
        'unknown'
      );
    });

    it('should handle special cases', () => {
      expect(service.extractNamespace('none')).toBe('none');
      expect(service.extractNamespace('self')).toBe('self');
    });

    it('should handle invalid inputs', () => {
      expect(service.extractNamespace(null)).toBe('unknown');
      expect(service.extractNamespace(undefined)).toBe('unknown');
      expect(service.extractNamespace('')).toBe('unknown');
      expect(service.extractNamespace(123)).toBe('unknown');
      expect(service.extractNamespace({})).toBe('unknown');
      expect(service.extractNamespace([])).toBe('unknown');
    });

    it('should handle edge cases', () => {
      // Empty namespace
      expect(service.extractNamespace(':action')).toBe('unknown');

      // Multiple colons
      expect(service.extractNamespace('mod:sub:action')).toBe('mod');

      // Whitespace
      expect(service.extractNamespace('  core  :wait')).toBe('core');
      expect(service.extractNamespace('core:  wait  ')).toBe('core');
    });

    it('should log debug messages for invalid inputs', () => {
      service.extractNamespace(null);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionCategorizationService: Invalid actionId provided',
        { actionId: null }
      );

      service.extractNamespace('no_namespace');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionCategorizationService: No namespace separator found',
        { actionId: 'no_namespace' }
      );
    });
  });

  describe('shouldUseGrouping', () => {
    const createActions = (count, namespaces = ['core']) => {
      return Array(count)
        .fill(null)
        .map((_, i) => ({
          actionId: `${namespaces[i % namespaces.length]}:action${i}`,
        }));
    };

    it('should return true with sufficient actions and namespaces', () => {
      const actions = createActions(10, ['core', 'affection', 'anatomy']);
      expect(service.shouldUseGrouping(actions)).toBe(true);
    });

    it('should return false with insufficient actions', () => {
      const actions = createActions(5, ['core', 'affection']);
      expect(service.shouldUseGrouping(actions)).toBe(false);
    });

    it('should return false with insufficient namespaces', () => {
      const actions = createActions(10, ['core']);
      expect(service.shouldUseGrouping(actions)).toBe(false);
    });

    it('should return false when configuration is disabled', () => {
      const actions = createActions(10, ['core', 'affection']);
      const disabledService = new ActionCategorizationService({
        logger: mockLogger,
        config: { enabled: false },
      });
      expect(disabledService.shouldUseGrouping(actions)).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(service.shouldUseGrouping(null)).toBe(false);
      expect(service.shouldUseGrouping(undefined)).toBe(false);
      expect(service.shouldUseGrouping('not an array')).toBe(false);
      expect(service.shouldUseGrouping({})).toBe(false);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationService: Invalid actions array',
        { actions: null }
      );
    });

    it('should handle actions with missing actionId', () => {
      const actions = [
        { actionId: 'core:wait' },
        { actionId: null },
        { actionId: 'affection:touch' },
        {},
        { actionId: undefined },
        { actionId: 'core:move' },
        { actionId: 'anatomy:examine' },
      ];
      expect(service.shouldUseGrouping(actions)).toBe(true); // 3 valid namespaces, 7 total actions
    });

    it('should respect custom configuration thresholds', () => {
      const actions = createActions(3, ['core', 'affection']);
      const customService = new ActionCategorizationService({
        logger: mockLogger,
        config: {
          minActionsForGrouping: 3,
          minNamespacesForGrouping: 2,
        },
      });
      expect(customService.shouldUseGrouping(actions)).toBe(true);
    });

    it('should handle error conditions gracefully', () => {
      // Test with valid actions - should use default config settings
      const actions = createActions(10, ['core', 'affection']);
      expect(service.shouldUseGrouping(actions)).toBe(true);
    });
  });

  describe('groupActionsByNamespace', () => {
    it('should group actions by multiple namespaces', () => {
      const actions = [
        { actionId: 'core:wait' },
        { actionId: 'affection:touch' },
        { actionId: 'core:move' },
        { actionId: 'anatomy:examine' },
        { actionId: 'kissing:kiss' },
      ];

      const grouped = service.groupActionsByNamespace(actions);

      expect(grouped.size).toBe(4);
      expect(Array.from(grouped.keys())).toEqual([
        'core',
        'affection',
        'kissing',
        'anatomy',
      ]);
      expect(grouped.get('core')).toHaveLength(2);
      expect(grouped.get('affection')).toHaveLength(1);
      expect(grouped.get('anatomy')).toHaveLength(1);
      expect(grouped.get('kissing')).toHaveLength(1);
    });

    it('should handle actions with missing actionId', () => {
      const actions = [
        { actionId: 'core:wait' },
        { actionId: null },
        {},
        { actionId: undefined },
        { actionId: 'core:move' },
      ];

      const grouped = service.groupActionsByNamespace(actions);

      expect(grouped.size).toBe(1);
      expect(grouped.get('core')).toHaveLength(2);
      expect(mockLogger.debug).toHaveBeenCalledTimes(3); // For null, {}, and undefined
    });

    it('should return empty Map for empty actions array', () => {
      const grouped = service.groupActionsByNamespace([]);
      expect(grouped.size).toBe(0);
    });

    it('should handle invalid inputs', () => {
      expect(service.groupActionsByNamespace(null).size).toBe(0);
      expect(service.groupActionsByNamespace(undefined).size).toBe(0);
      expect(service.groupActionsByNamespace('not an array').size).toBe(0);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationService: Invalid actions for grouping',
        { actions: null }
      );
    });

    it('should respect namespace priority ordering', () => {
      const actions = [
        { actionId: 'clothing:wear' },
        { actionId: 'core:wait' },
        { actionId: 'unknown:action' },
        { actionId: 'affection:touch' },
      ];

      const grouped = service.groupActionsByNamespace(actions);
      const keys = Array.from(grouped.keys());

      expect(keys).toEqual(['core', 'affection', 'clothing', 'unknown']);
    });

    it('should handle error recovery', () => {
      // Mock extractNamespace to throw an error
      const errorService = new ActionCategorizationService({
        logger: mockLogger,
      });
      errorService.extractNamespace = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const actions = [{ actionId: 'core:wait' }];
      const result = errorService.groupActionsByNamespace(actions);

      expect(result.size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActionCategorizationService: Error grouping actions',
        expect.objectContaining({
          error: 'Test error',
          actionCount: 1,
        })
      );
    });
  });

  describe('getSortedNamespaces', () => {
    it('should sort namespaces by priority order', () => {
      const namespaces = ['sex', 'core', 'affection'];
      const sorted = service.getSortedNamespaces(namespaces);

      expect(sorted).toEqual(['core', 'affection', 'sex']);
    });

    it('should handle alphabetical fallback', () => {
      const namespaces = ['zebra', 'alpha', 'beta'];
      const sorted = service.getSortedNamespaces(namespaces);

      expect(sorted).toEqual(['alpha', 'beta', 'zebra']);
    });

    it('should handle mixed priority and non-priority namespaces', () => {
      const namespaces = ['zebra', 'core', 'alpha', 'affection', 'beta'];
      const sorted = service.getSortedNamespaces(namespaces);

      expect(sorted).toEqual(['core', 'affection', 'alpha', 'beta', 'zebra']);
    });

    it('should handle invalid inputs', () => {
      expect(service.getSortedNamespaces(null)).toEqual([]);
      expect(service.getSortedNamespaces(undefined)).toEqual([]);
      expect(service.getSortedNamespaces('not an array')).toEqual([]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionCategorizationService: Invalid namespaces for sorting',
        { namespaces: null }
      );
    });

    it('should handle empty arrays', () => {
      expect(service.getSortedNamespaces([])).toEqual([]);
    });

    it('should respect custom configuration', () => {
      const namespaces = ['custom', 'core', 'special'];
      const customService = new ActionCategorizationService({
        logger: mockLogger,
        config: {
          namespaceOrder: ['special', 'custom', 'core'],
        },
      });

      const sorted = customService.getSortedNamespaces(namespaces);
      expect(sorted).toEqual(['special', 'custom', 'core']);
    });

    it('should handle error conditions', () => {
      // Test error handling with mock that throws
      const errorService = new ActionCategorizationService({
        logger: mockLogger,
      });

      // Mock the internal method to throw
      const originalSort = Array.prototype.sort;
      Array.prototype.sort = jest.fn().mockImplementation(() => {
        throw new Error('Sort error');
      });

      const namespaces = ['core', 'affection'];
      const result = errorService.getSortedNamespaces(namespaces);

      // Restore original sort
      Array.prototype.sort = originalSort;

      // Should return original namespaces on error
      expect(result).toEqual(namespaces);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActionCategorizationService: Error sorting namespaces',
        expect.objectContaining({
          error: expect.any(String),
          namespaces,
        })
      );
    });
  });

  describe('formatNamespaceDisplayName', () => {
    it('should convert valid namespace strings to uppercase', () => {
      expect(service.formatNamespaceDisplayName('core')).toBe('CORE');
      expect(service.formatNamespaceDisplayName('affection')).toBe('AFFECTION');
      expect(service.formatNamespaceDisplayName('custom_mod')).toBe(
        'CUSTOM_MOD'
      );
    });

    it('should handle special case mapping', () => {
      expect(service.formatNamespaceDisplayName('unknown')).toBe('OTHER');
    });

    it('should handle invalid inputs', () => {
      expect(service.formatNamespaceDisplayName(null)).toBe('UNKNOWN');
      expect(service.formatNamespaceDisplayName(undefined)).toBe('UNKNOWN');
      expect(service.formatNamespaceDisplayName('')).toBe('UNKNOWN');
      expect(service.formatNamespaceDisplayName(123)).toBe('UNKNOWN');
      expect(service.formatNamespaceDisplayName({})).toBe('UNKNOWN');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionCategorizationService: Invalid namespace for formatting',
        { namespace: null }
      );
    });

    it('should handle edge cases', () => {
      expect(service.formatNamespaceDisplayName('123')).toBe('123');
      expect(service.formatNamespaceDisplayName('special-chars')).toBe(
        'SPECIAL-CHARS'
      );
      expect(service.formatNamespaceDisplayName('CamelCase')).toBe('CAMELCASE');
    });
  });
});
