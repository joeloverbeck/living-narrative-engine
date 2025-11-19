/**
 * @file Unit tests for TaskLoader
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import TaskLoader from '../../../src/loaders/taskLoader.js';

describe('TaskLoader', () => {
  let testBed;
  let taskLoader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    mockConfig = testBed.createMock('IConfiguration', [
      'get',
      'getModsBasePath',
      'getContentTypeSchemaId',
    ]);
    mockConfig.get.mockReturnValue({});
    mockConfig.getModsBasePath.mockReturnValue('/path/to/mods');
    mockConfig.getContentTypeSchemaId.mockReturnValue(
      'schema://living-narrative-engine/task.schema.json'
    );

    mockPathResolver = testBed.createMock('IPathResolver', [
      'resolveModPath',
      'resolvePath',
      'resolveModContentPath',
    ]);
    mockPathResolver.resolveModPath.mockImplementation(
      (modId, path) => `/resolved/${modId}/${path}`
    );
    mockPathResolver.resolvePath.mockImplementation(
      (path) => `/resolved/${path}`
    );
    mockPathResolver.resolveModContentPath.mockImplementation(
      (modId, contentType, filename) =>
        `/resolved/${modId}/${contentType}/${filename}`
    );

    mockDataFetcher = testBed.createMock('IDataFetcher', [
      'fetchJson',
      'fetch',
    ]);
    mockDataFetcher.fetch.mockImplementation((path) => {
      const parts = path.split('/');
      const contentType = parts[3];

      if (contentType === 'refinement-methods') {
        const modId = parts[2] || 'core';
        const relativePath = parts.slice(4).join('/');
        const segments = relativePath.split('/');
        const taskSegment = segments[0];
        const fileName = segments[segments.length - 1] || '';
        const methodName = fileName.replace('.refinement.json', '');
        return Promise.resolve({
          id: `${modId}:${taskSegment}.${methodName}`,
          taskId: `${modId}:${taskSegment}`,
        });
      }

      return Promise.resolve({});
    });

    mockSchemaValidator = testBed.createMock('ISchemaValidator', [
      'validate',
      'getValidator',
      'isSchemaLoaded',
    ]);
    mockSchemaValidator.validate.mockReturnValue({ valid: true });
    mockSchemaValidator.getValidator.mockReturnValue({
      validate: jest.fn().mockReturnValue(true),
    });
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    mockDataRegistry = testBed.createMock('IDataRegistry', [
      'register',
      'get',
      'getAll',
      'store',
    ]);
    mockDataRegistry.getAll.mockReturnValue([]);
    mockDataRegistry.get.mockImplementation((category, key) => {
      if (category === 'scopes' && key) {
        return { id: key };
      }
      return null;
    });

    mockLogger = testBed.createMockLogger();

    taskLoader = new TaskLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should initialize with content type "tasks"', () => {
      expect(taskLoader).toBeDefined();
      // TaskLoader extends SimpleItemLoader with content type 'tasks'
    });
  });

  describe('_validateTaskStructure', () => {
    const baseTask = () => ({
      id: 'core:test_task',
      planningScope: 'core:items',
      refinementMethods: [],
      planningEffects: [],
    });

    it('should accept valid namespaced scope reference', async () => {
      const data = baseTask();
      data.planningScope = 'core:known_items';

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).resolves.toBeUndefined();
    });

    it('should reject planning scope if referenced scope is missing', async () => {
      const data = baseTask();
      data.planningScope = 'core:unknown_scope';

      mockDataRegistry.get.mockImplementation(() => null);

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(
        /planningScope 'core:unknown_scope' references a scope that is not loaded/
      );
    });

    it('should accept special scope "none"', async () => {
      const data = baseTask();
      data.planningScope = 'none';

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).resolves.toBeUndefined();
    });

    it('should accept special scope "self"', async () => {
      const data = baseTask();
      data.planningScope = 'self';

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).resolves.toBeUndefined();
    });

    it('should reject invalid scope reference format', async () => {
      const data = baseTask();
      data.planningScope = 'invalid-scope';

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/planningScope.*must be a valid scope reference/);
    });

    it('should reject refinement method without methodId', async () => {
      const data = baseTask();
      data.refinementMethods = [
        { $ref: 'refinement-methods/test_task/method_one.refinement.json' },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must have methodId and \$ref properties/);
    });

    it('should reject refinement method without $ref', async () => {
      const data = baseTask();
      data.refinementMethods = [{ methodId: 'core:test_task.method1' }];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must have methodId and \$ref properties/);
    });

    it('should reject refinement method with invalid ID format', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'invalid-format',
          $ref: 'refinement-methods/test_task/method_one.refinement.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must follow format 'modId:task_id\.method_name'/);
    });

    it('should reject refinement method with mismatched task ID', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:other_task.method1',
          $ref: 'refinement-methods/test_task/method_one.refinement.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/task portion must match task ID base name/);
    });

    it('should accept valid refinement method', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.refinement.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).resolves.toBeUndefined();
    });

    it('should reject refinement method paths that leave the refinement-methods folder', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: '../refinement-methods/test_task/method1.refinement.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must begin with 'refinement-methods\//);
    });

    it('should reject refinement method paths with traversal segments', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/../method1.refinement.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/contains invalid path segments/);
    });

    it('should reject refinement method paths that are not .refinement.json files', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.json',
        },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must point to a \.refinement\.json file/);
    });

    it('should reject when referenced refinement method file is missing', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.refinement.json',
        },
      ];

      mockDataFetcher.fetch.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/Failed to load refinement method 'core:test_task.method1'/);
    });

    it('should reject when referenced refinement method declares a mismatched id', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.refinement.json',
        },
      ];

      mockDataFetcher.fetch.mockResolvedValueOnce({
        id: 'core:test_task.other',
        taskId: 'core:test_task',
      });

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/declares id 'core:test_task.other'/);
    });

    it('should reject when referenced refinement method declares a mismatched taskId', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.refinement.json',
        },
      ];

      mockDataFetcher.fetch.mockResolvedValueOnce({
        id: 'core:test_task.method1',
        taskId: 'core:other_task',
      });

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/declares taskId 'core:other_task'/);
    });

    it('should cache validated refinement methods per mod', async () => {
      const data = baseTask();
      data.refinementMethods = [
        {
          methodId: 'core:test_task.method1',
          $ref: 'refinement-methods/test_task/method1.refinement.json',
        },
      ];

      mockDataFetcher.fetch.mockClear();
      await taskLoader._validateTaskStructure(data, 'core', 'file-1.task.json');
      await taskLoader._validateTaskStructure(data, 'core', 'file-2.task.json');

      expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('should reject planning effect without type', async () => {
      const data = baseTask();
      data.planningEffects = [{ parameters: { entityId: 'actor' } }];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).rejects.toThrow(/must have a 'type' property/);
    });

    it('should accept valid planning effect', async () => {
      const data = baseTask();
      data.planningEffects = [
        { type: 'ADD_COMPONENT', parameters: { entityId: 'actor' } },
      ];

      await expect(
        taskLoader._validateTaskStructure(data, 'core', 'test.task.json')
      ).resolves.toBeUndefined();
    });
  });

  describe('_isValidScopeReference', () => {
    it('should return true for "none"', () => {
      expect(taskLoader._isValidScopeReference('none')).toBe(true);
    });

    it('should return true for "self"', () => {
      expect(taskLoader._isValidScopeReference('self')).toBe(true);
    });

    it('should return true for valid namespaced reference', () => {
      expect(taskLoader._isValidScopeReference('core:items')).toBe(true);
      expect(taskLoader._isValidScopeReference('mod_name:scope_name')).toBe(
        true
      );
    });

    it('should return false for invalid formats', () => {
      expect(taskLoader._isValidScopeReference('no-namespace')).toBe(false);
      expect(taskLoader._isValidScopeReference('core:')).toBe(false);
      expect(taskLoader._isValidScopeReference(':scope')).toBe(false);
      expect(taskLoader._isValidScopeReference('core:scope:extra')).toBe(
        false
      );
    });
  });

  describe('_isValidRefinementMethodId', () => {
    it('should return true for valid method ID', () => {
      expect(
        taskLoader._isValidRefinementMethodId('core:test_task.method1')
      ).toBe(true);
      expect(
        taskLoader._isValidRefinementMethodId('mod:task_id.method_name')
      ).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(taskLoader._isValidRefinementMethodId('invalid')).toBe(false);
      expect(taskLoader._isValidRefinementMethodId('core:task')).toBe(false);
      expect(taskLoader._isValidRefinementMethodId('core.method')).toBe(false);
      expect(
        taskLoader._isValidRefinementMethodId('core:task.method.extra')
      ).toBe(false);
    });
  });

  describe('_processFetchedItem', () => {
    it('should apply default cost if undefined', async () => {
      const data = {
        id: 'core:test_task',
        description: 'Test task',
        planningScope: 'core:items',
        refinementMethods: [],
        planningEffects: [],
      };

      mockSchemaValidator.validate.mockReturnValue({ valid: true });

      await taskLoader._processFetchedItem(
        'core',
        'test.task.json',
        '/path/test.task.json',
        data,
        'tasks'
      );

      expect(data.cost).toBe(10);
    });

    it('should apply default priority if undefined', async () => {
      const data = {
        id: 'core:test_task',
        description: 'Test task',
        planningScope: 'core:items',
        refinementMethods: [],
        planningEffects: [],
      };

      mockSchemaValidator.validate.mockReturnValue({ valid: true });

      await taskLoader._processFetchedItem(
        'core',
        'test.task.json',
        '/path/test.task.json',
        data,
        'tasks'
      );

      expect(data.priority).toBe(50);
    });

    it('should not override explicit cost', async () => {
      const data = {
        id: 'core:test_task',
        description: 'Test task',
        planningScope: 'core:items',
        refinementMethods: [],
        planningEffects: [],
        cost: 25,
      };

      mockSchemaValidator.validate.mockReturnValue({ valid: true });

      await taskLoader._processFetchedItem(
        'core',
        'test.task.json',
        '/path/test.task.json',
        data,
        'tasks'
      );

      expect(data.cost).toBe(25);
    });

    it('should not override explicit priority', async () => {
      const data = {
        id: 'core:test_task',
        description: 'Test task',
        planningScope: 'core:items',
        refinementMethods: [],
        planningEffects: [],
        priority: 75,
      };

      mockSchemaValidator.validate.mockReturnValue({ valid: true });

      await taskLoader._processFetchedItem(
        'core',
        'test.task.json',
        '/path/test.task.json',
        data,
        'tasks'
      );

      expect(data.priority).toBe(75);
    });

    it('should throw error for invalid task structure', async () => {
      const data = {
        id: 'core:test_task',
        description: 'Test task',
        planningScope: 'invalid-scope',
        refinementMethods: [],
        planningEffects: [],
      };

      await expect(
        taskLoader._processFetchedItem(
          'core',
          'test.task.json',
          '/path/test.task.json',
          data,
          'tasks'
        )
      ).rejects.toThrow(/planningScope.*must be a valid scope reference/);
    });
  });

  describe('_logTaskDetails', () => {
    it('should log basic task information', () => {
      const data = {
        id: 'core:test_task',
        planningScope: 'core:items',
        refinementMethods: [{ methodId: 'core:test_task.m1', $ref: 'p.json' }],
        planningPreconditions: [{ condition: {} }],
        planningEffects: [{ type: 'ADD_COMPONENT' }],
        cost: 10,
        priority: 50,
      };

      taskLoader._logTaskDetails(data, 'core:test_task');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('1 refinement method(s)'),
        expect.objectContaining({
          taskId: 'core:test_task',
          planningScope: 'core:items',
          cost: 10,
          priority: 50,
        })
      );
    });

    it('should handle missing optional fields', () => {
      const data = {
        id: 'core:test_task',
        planningScope: 'core:items',
      };

      taskLoader._logTaskDetails(data, 'core:test_task');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('0 refinement method(s)'),
        expect.objectContaining({
          taskId: 'core:test_task',
        })
      );
    });
  });

  describe('loadItemsForMod', () => {
    it('should log summary statistics', async () => {
      const modManifest = { id: 'core', content: { tasks: [] } };

      mockDataRegistry.getAll.mockReturnValue([
        {
          id: 'core:task1',
          refinementMethods: [{ methodId: 'core:task1.m1', $ref: 'p1.json' }],
        },
        {
          id: 'core:task2',
          refinementMethods: [
            { methodId: 'core:task2.m1', $ref: 'p2.json' },
            { methodId: 'core:task2.m2', $ref: 'p3.json' },
          ],
        },
      ]);

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 planning task(s) with 3 total refinement')
      );
    });

    it('should not log if no tasks loaded', async () => {
      const modManifest = { id: 'core', content: { tasks: [] } };
      mockDataRegistry.getAll.mockReturnValue([]);

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('planning task')
      );
    });
  });
});
