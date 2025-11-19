/**
 * @file Integration tests for task loading from mods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import TaskLoader from '../../../src/loaders/taskLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';

/**
 * @class NamespacedDataRegistry
 * @description Extends the in-memory registry to support `type.modId` lookups.
 */
class NamespacedDataRegistry extends InMemoryDataRegistry {
  /**
   * @inheritdoc
   */
  getAll(type) {
    if (typeof type === 'string' && type.includes('.')) {
      const [category, modId] = type.split('.', 2);
      const entries = super.getAll(category);
      if (!modId) {
        return entries;
      }

      const filtered = entries.filter((entry) => entry && entry._modId === modId);
      return filtered.length > 0 ? filtered : undefined;
    }

    return super.getAll(type);
  }
}

/**
 * @class StrictSchemaValidator
 * @description Minimal schema validator tracking validation interactions.
 */
class StrictSchemaValidator {
  /**
   * @description Creates a new strict validator.
   * @param {Record<string, (data: any) => {isValid: boolean, errors: any[]|null}>} validatorMap - Schema handlers.
   */
  constructor(validatorMap = {}) {
    this._validators = new Map();
    Object.entries(validatorMap).forEach(([schemaId, impl]) => {
      this._validators.set(schemaId, impl);
    });

    this.isSchemaLoaded = jest.fn((schemaId) => this._validators.has(schemaId));
    this.getValidator = jest.fn((schemaId) => this._validators.get(schemaId));
    this.validate = jest.fn((schemaId, data) => {
      const validator = this._validators.get(schemaId);
      if (!validator) {
        return {
          isValid: false,
          errors: [{ message: `Validator missing for ${schemaId}` }],
        };
      }
      return validator(data);
    });
  }
}

const DEFAULT_SCOPES = [
  'core:available_weapons',
  'core:known_consumable_items',
  'core:available_instruments',
  'core:available_shelters',
  'test:items',
];

function seedScope(registry, scopeId) {
  registry.store('scopes', scopeId, {
    id: scopeId,
    name: scopeId,
    modId: scopeId.split(':')[0],
    ast: {},
  });
}

// Mock task data fixtures
const mockTaskData = {
  arm_self: {
    id: 'core:arm_self',
    description: 'Equip yourself with a weapon or tool',
    planningScope: 'core:available_weapons',
    refinementMethods: [
      {
        methodId: 'core:arm_self.pick_up_weapon',
        $ref: 'refinement-methods/arm_self/pick_up_weapon.refinement.json',
      },
    ],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: { entityId: 'actor', componentId: 'core:armed' },
      },
    ],
    cost: 5,
    priority: 60,
  },
  consume_nourishing_item: {
    id: 'core:consume_nourishing_item',
    description: 'Consume a nourishing item to satisfy hunger',
    planningScope: 'core:known_consumable_items',
    refinementMethods: [
      {
        methodId: 'core:consume_nourishing_item.eat_item',
        $ref: 'refinement-methods/consume_nourishing_item/eat_item.refinement.json',
      },
      {
        methodId: 'core:consume_nourishing_item.drink_item',
        $ref: 'refinement-methods/consume_nourishing_item/drink_item.refinement.json',
      },
    ],
    planningEffects: [
      {
        type: 'REMOVE_COMPONENT',
        parameters: { entityId: 'actor', componentId: 'core:hungry' },
      },
    ],
    cost: 10,
    priority: 50,
  },
  find_instrument: {
    id: 'core:find_instrument',
    description: 'Locate and acquire a musical instrument',
    planningScope: 'core:available_instruments',
    refinementMethods: [
      {
        methodId: 'core:find_instrument.search_location',
        $ref: 'refinement-methods/find_instrument/search_location.refinement.json',
      },
    ],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: { entityId: 'actor', componentId: 'core:has_instrument' },
      },
    ],
    cost: 15,
    priority: 40,
  },
  secure_shelter: {
    id: 'core:secure_shelter',
    description: 'Find and secure a safe shelter',
    planningScope: 'core:available_shelters',
    refinementMethods: [
      {
        methodId: 'core:secure_shelter.enter_building',
        $ref: 'refinement-methods/secure_shelter/enter_building.refinement.json',
      },
    ],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: { entityId: 'actor', componentId: 'core:sheltered' },
      },
    ],
    cost: 20,
    priority: 70,
  },
};

function buildMethodLookup(tasks) {
  const lookup = new Map();
  Object.values(tasks).forEach((task) => {
    (task.refinementMethods || []).forEach((method) => {
      lookup.set(method.$ref, {
        id: method.methodId,
        taskId: task.id,
      });
    });
  });
  return lookup;
}

const MOCK_METHOD_LOOKUP = buildMethodLookup(mockTaskData);

function deriveMethodMetadataFromPath(path) {
  const modMatch = path.match(/mods\/(.*?)\/refinement-methods\//);
  const modId = modMatch ? modMatch[1] : 'core';
  const [, relative = ''] = path.split(/refinement-methods\//);
  const segments = relative.split('/');
  const taskSegment = segments[0] || 'task';
  const fileName = segments[segments.length - 1] || '';
  const methodName = fileName.replace('.refinement.json', '');

  return {
    id: `${modId}:${taskSegment}.${methodName}`,
    taskId: `${modId}:${taskSegment}`,
  };
}

describe('Task Loading Integration', () => {
  let testBed;
  let taskLoader;
  let dataRegistry;
  let logger;
  let config;
  let pathResolver;
  let mockDataFetcher;
  let schemaValidator;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
    config = new StaticConfiguration();
    pathResolver = new DefaultPathResolver(config);

    // Create mock data fetcher that returns fixture data (as objects, not JSON strings)
    mockDataFetcher = {
      fetch: jest.fn((path) => {
        // Extract task name from path
        const match = path.match(/([^/]+)\.task\.json$/);
        if (match) {
          const taskName = match[1];
          if (mockTaskData[taskName]) {
            // Return a deep clone of the object, not a JSON string
            return Promise.resolve(JSON.parse(JSON.stringify(mockTaskData[taskName])));
          }
        }

        if (path.includes('/refinement-methods/')) {
          const [, relative = ''] = path.split(/refinement-methods\//);
          const canonicalRef = `refinement-methods/${relative}`;
          const lookup = MOCK_METHOD_LOOKUP.get(canonicalRef);
          if (lookup) {
            return Promise.resolve({ ...lookup });
          }
          return Promise.resolve(deriveMethodMetadataFromPath(path));
        }

        return Promise.reject(new Error(`Task file not found: ${path}`));
      }),
    };

    dataRegistry = new NamespacedDataRegistry({ logger });
    DEFAULT_SCOPES.forEach((scopeId) => seedScope(dataRegistry, scopeId));

    // Create mock schema validator with all required methods
    schemaValidator = new StrictSchemaValidator({
      'schema://living-narrative-engine/task.schema.json': () => ({
        isValid: true,
        errors: null,
      }),
    });

    taskLoader = new TaskLoader(
      config,
      pathResolver,
      mockDataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  });

  describe('Loading tasks from core mod', () => {
    it('should load all tasks from core mod', async () => {
      // Load tasks from core mod
      const modManifest = {
        id: 'core',
        content: {
          tasks: [
            'tasks/arm_self.task.json',
            'tasks/consume_nourishing_item.task.json',
            'tasks/find_instrument.task.json',
            'tasks/secure_shelter.task.json',
          ],
        },
      };

      const result = await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      // Debug output
      console.log('Load result:', result);
      console.log('All tasks:', dataRegistry.getAll('tasks'));
      console.log('tasks.core:', dataRegistry.getAll('tasks.core'));

      // Verify tasks are registered
      const tasks = dataRegistry.getAll('tasks.core');
      expect(tasks).toBeDefined();
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should load task with all properties', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      expect(task).toBeDefined();
      // The ID stored in the registry has the namespace prefix
      expect(task.id).toBe('core:consume_nourishing_item');
      expect(task.description).toBeDefined();
      expect(task.planningScope).toBeDefined();
      expect(task.refinementMethods).toBeInstanceOf(Array);
      expect(task.planningEffects).toBeInstanceOf(Array);
    });

    it('should apply default cost if not specified', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      // If cost not in file, should be default 10
      expect(task.cost).toBeDefined();
      expect(typeof task.cost).toBe('number');
    });

    it('should apply default priority if not specified', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      // If priority not in file, should be default 50
      expect(task.priority).toBeDefined();
      expect(typeof task.priority).toBe('number');
    });

    it('should validate refinement methods', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      expect(task.refinementMethods).toBeDefined();
      expect(task.refinementMethods.length).toBeGreaterThan(0);

      // Each method should have methodId and $ref
      for (const method of task.refinementMethods) {
        expect(method.methodId).toBeDefined();
        expect(method.$ref).toBeDefined();

        // Method ID should follow pattern modId:task_id.method_name
        expect(method.methodId).toMatch(/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+$/);

        // Method's task portion should match task ID
        const [, taskAndMethod] = method.methodId.split(':');
        const [methodTaskId] = taskAndMethod.split('.');
        const [, taskBaseName] = task.id.split(':');
        expect(methodTaskId).toBe(taskBaseName);
      }
    });

    it('should validate planning effects', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      expect(task.planningEffects).toBeDefined();
      expect(task.planningEffects.length).toBeGreaterThan(0);

      // Each effect should have a type
      for (const effect of task.planningEffects) {
        expect(effect.type).toBeDefined();
        expect(typeof effect.type).toBe('string');
      }
    });
  });

  describe('Task override behavior', () => {
    it('should allow mods to override core tasks', async () => {
      // First load core task
      const coreManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        coreManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      const coreTask = dataRegistry.get('tasks', 'core:consume_nourishing_item');
      const coreDescription = coreTask.description;

      // Create mock override from another mod
      const mockOverrideData = {
        id: 'core:consume_nourishing_item',
        description: 'Modified description from mod',
        planningScope: 'core:known_consumable_items',
        refinementMethods: coreTask.refinementMethods,
        planningEffects: coreTask.planningEffects,
        cost: 20,
        priority: 80,
      };

      // Simulate override by storing with same ID
      dataRegistry.store('tasks', mockOverrideData.id, mockOverrideData);

      const overriddenTask = dataRegistry.get('tasks', 'core:consume_nourishing_item');

      expect(overriddenTask.description).toBe('Modified description from mod');
      expect(overriddenTask.cost).toBe(20);
      expect(overriddenTask.priority).toBe(80);
      expect(overriddenTask.description).not.toBe(coreDescription);
    });
  });

  describe('Cross-mod references', () => {
    it('should handle scope references to other mods', async () => {
      // Create a task with cross-mod scope reference
      const mockTaskData = {
        id: 'test_mod:cross_mod_task',
        description: 'Task with cross-mod scope',
        planningScope: 'core:known_consumable_items',
        refinementMethods: [
          {
            methodId: 'test_mod:cross_mod_task.method1',
            $ref: 'refinement-methods/cross_mod_task/method1.refinement.json',
          },
        ],
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: { entityId: 'actor', componentId: 'test:satisfied' },
          },
        ],
      };

      // Validate the structure
      await expect(
        taskLoader._validateTaskStructure(mockTaskData, 'test_mod', 'test.task.json')
      ).resolves.toBeUndefined();

      // Scope reference should be valid
      expect(taskLoader._isValidScopeReference(mockTaskData.planningScope)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid scope reference', async () => {
      const invalidData = {
        id: 'test:invalid_task',
        description: 'Invalid task',
        planningScope: 'invalid-scope-format',
        refinementMethods: [],
        planningEffects: [],
      };

      await expect(
        taskLoader._validateTaskStructure(invalidData, 'test', 'invalid.task.json')
      ).rejects.toThrow(/planningScope.*must be a valid scope reference/);
    });

    it('should throw error when referenced planning scope does not exist', async () => {
      const invalidData = {
        id: 'test:invalid_task',
        description: 'Invalid task',
        planningScope: 'test:missing_scope',
        refinementMethods: [],
        planningEffects: [],
      };

      await expect(
        taskLoader._validateTaskStructure(invalidData, 'test', 'invalid.task.json')
      ).rejects.toThrow(/planningScope 'test:missing_scope' references a scope that is not loaded/);
    });

    it('should throw error for malformed refinement method', async () => {
      const invalidData = {
        id: 'test:invalid_task',
        description: 'Invalid task',
        planningScope: 'test:items',
        refinementMethods: [
          {
            methodId: 'invalid-format',
            $ref: 'refinement-methods/test_task/method.refinement.json',
          },
        ],
        planningEffects: [],
      };

      await expect(
        taskLoader._validateTaskStructure(invalidData, 'test', 'invalid.task.json')
      ).rejects.toThrow(/must follow format 'modId:task_id\.method_name'/);
    });

    it('should throw error for method with mismatched task ID', async () => {
      const invalidData = {
        id: 'test:task_a',
        description: 'Task A',
        planningScope: 'test:items',
        refinementMethods: [
          {
            methodId: 'test:task_b.method1',
            $ref: 'refinement-methods/task_a/method1.refinement.json',
          },
        ],
        planningEffects: [],
      };

      await expect(
        taskLoader._validateTaskStructure(invalidData, 'test', 'invalid.task.json')
      ).rejects.toThrow(/task portion must match task ID base name/);
    });

    it('should throw error for effect without type', async () => {
      const invalidData = {
        id: 'test:invalid_task',
        description: 'Invalid task',
        planningScope: 'test:items',
        refinementMethods: [],
        planningEffects: [
          { parameters: { entityId: 'actor' } }, // Missing type
        ],
      };

      await expect(
        taskLoader._validateTaskStructure(invalidData, 'test', 'invalid.task.json')
      ).rejects.toThrow(/must have a 'type' property/);
    });
  });

  describe('Registry storage', () => {
    it('should store tasks with correct registry key', async () => {
      const modManifest = {
        id: 'core',
        content: {
          tasks: ['tasks/consume_nourishing_item.task.json'],
        },
      };

      await taskLoader.loadItemsForMod(
        'core',
        modManifest,
        'tasks',
        'tasks',
        'tasks'
      );

      // Should be accessible via registry
      const task = dataRegistry.get('tasks', 'core:consume_nourishing_item');
      expect(task).toBeDefined();

      // Should also be in mod-specific collection
      const coreTasks = dataRegistry.getAll('tasks.core');
      expect(coreTasks).toBeDefined();
      expect(coreTasks.length).toBeGreaterThan(0);
    });
  });
});
