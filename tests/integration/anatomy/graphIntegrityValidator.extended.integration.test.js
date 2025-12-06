import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';

/**
 * Simple structured clone helper that falls back to JSON cloning when
 * structuredClone is not available in the environment.
 *
 * @param {any} value - Value to clone.
 * @returns {any} Deep cloned value.
 */
function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Lightweight in-memory entity manager implementation that provides the
 * surface required by GraphIntegrityValidator and its rule chain.
 */
class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.componentsByEntity = new Map();
  }

  #ensureEntity(entityId) {
    if (!this.componentsByEntity.has(entityId)) {
      this.componentsByEntity.set(entityId, new Map());
    }
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.componentsByEntity.get(entityId).set(componentId, deepClone(data));
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const entityComponents = this.componentsByEntity.get(entityId);
    if (!entityComponents) {
      return null;
    }
    const stored = entityComponents.get(componentId);
    return stored === undefined ? null : deepClone(stored);
  }

  getAllComponentTypesForEntity(entityId) {
    const entityComponents = this.componentsByEntity.get(entityId);
    if (!entityComponents) {
      return [];
    }
    return Array.from(entityComponents.keys());
  }

  getEntityInstance(entityId) {
    if (!this.componentsByEntity.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

/**
 * Creates a capturing logger that records every invocation for later assertions.
 *
 * @returns {{ entries: Array<{ level: string, message: string, details: any[] }>, debug: Function, info: Function, warn: Function, error: Function }}
 */
function createRecordingLogger() {
  const entries = [];
  const record =
    (level) =>
    (message, ...details) => {
      entries.push({ level, message, details });
    };

  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
}

/**
 * Registers a set of components for an entity on the provided entity manager.
 *
 * @param {InMemoryEntityManager} entityManager
 * @param {string} entityId
 * @param {Record<string, any>} components
 */
function registerEntity(entityManager, entityId, components) {
  for (const [componentId, data] of Object.entries(components)) {
    entityManager.addComponent(entityId, componentId, data);
  }
}

describe('GraphIntegrityValidator comprehensive integration', () => {
  let entityManager;
  let logger;
  let validator;

  beforeEach(() => {
    entityManager = new InMemoryEntityManager();
    logger = createRecordingLogger();
    validator = new GraphIntegrityValidator({ entityManager, logger });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports aggregated validation issues for a complex invalid graph', async () => {
    registerEntity(entityManager, 'root', {
      'anatomy:part': { subType: 'torso' },
      'anatomy:sockets': {
        sockets: [{ id: 'arm-socket', allowedTypes: ['arm'] }],
      },
    });

    registerEntity(entityManager, 'arm', {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: 'root', socketId: 'arm-socket' },
      'anatomy:sockets': {
        sockets: [{ id: 'hand-socket', allowedTypes: ['claw'] }],
      },
      'equipment:grip': { strength: 5 },
    });

    registerEntity(entityManager, 'hand', {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: 'arm', socketId: 'hand-socket' },
      'custom:module': { id: 'claw-upgrade' },
    });

    registerEntity(entityManager, 'cycle-a', {
      'anatomy:part': { subType: 'tentacle' },
      'anatomy:joint': { parentId: 'cycle-b', socketId: 'loop' },
      'anatomy:sockets': {
        sockets: [{ id: 'loop', allowedTypes: ['tentacle'] }],
      },
    });

    registerEntity(entityManager, 'cycle-b', {
      'anatomy:part': { subType: 'tentacle' },
      'anatomy:joint': { parentId: 'cycle-a', socketId: 'loop' },
      'anatomy:sockets': {
        sockets: [{ id: 'loop', allowedTypes: ['tentacle'] }],
      },
    });

    registerEntity(entityManager, 'orphan', {
      'anatomy:part': { subType: 'leg' },
      'anatomy:joint': { parentId: 'missing-parent', socketId: 'leg-socket' },
    });

    registerEntity(entityManager, 'free-root', {
      'anatomy:part': { subType: 'wing' },
    });

    const entityIds = [
      'root',
      'arm',
      'hand',
      'cycle-a',
      'cycle-b',
      'orphan',
      'free-root',
    ];

    const socketOccupancy = new Set(['root:arm-socket', 'root:ghost-socket']);

    const recipe = {
      constraints: {
        requires: [{ partTypes: ['arm'], components: ['equipment:shield'] }],
        excludes: [{ components: ['equipment:grip', 'custom:module'] }],
      },
      slots: {
        arms: { type: 'arm', count: 2 },
      },
    };

    const result = await validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Socket 'ghost-socket' not found"),
        expect.stringContaining('Required constraint not satisfied'),
        expect.stringContaining('Exclusion constraint violated'),
        expect.stringContaining("Slot 'arms': expected exactly 2 parts"),
        expect.stringContaining('Cycle detected'),
        expect.stringContaining('joint referencing non-existent parent'),
        expect.stringContaining('Orphaned part'),
        expect.stringContaining("Part type 'hand' not allowed"),
      ])
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Multiple root entities found'),
      ])
    );

    const errorLogs = logger.entries.filter((entry) => entry.level === 'error');
    expect(
      errorLogs.some((entry) =>
        entry.message.includes('Validation failed with')
      )
    ).toBe(true);
  });

  it('emits warnings when validation succeeds with non-critical issues', async () => {
    registerEntity(entityManager, 'root-a', {
      'anatomy:part': { subType: 'torso' },
    });
    registerEntity(entityManager, 'root-b', {
      'anatomy:part': { subType: 'arm' },
    });

    const result = await validator.validateGraph(
      ['root-a', 'root-b'],
      { constraints: {} },
      new Set()
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Multiple root entities found'),
      ])
    );

    const warningLog = logger.entries.find((entry) => entry.level === 'warn');
    expect(warningLog?.message).toContain('Validation passed with');
  });

  it('passes validation without warnings for a consistent anatomy graph', async () => {
    entityManager = new InMemoryEntityManager();
    logger = createRecordingLogger();
    validator = new GraphIntegrityValidator({ entityManager, logger });

    registerEntity(entityManager, 'torso', {
      'anatomy:part': { subType: 'torso' },
      'anatomy:sockets': {
        sockets: [{ id: 'arm-socket', allowedTypes: ['arm'] }],
      },
    });

    registerEntity(entityManager, 'arm', {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: 'torso', socketId: 'arm-socket' },
      'anatomy:sockets': {
        sockets: [{ id: 'hand-socket', allowedTypes: ['hand', '*'] }],
      },
      'equipment:grip': { strength: 2 },
    });

    registerEntity(entityManager, 'hand', {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: 'arm', socketId: 'hand-socket' },
    });

    const recipe = {
      constraints: {
        requires: [{ partTypes: ['arm'], components: ['equipment:grip'] }],
      },
      slots: {
        arms: { type: 'arm', count: 1 },
      },
    };

    const result = await validator.validateGraph(
      ['torso', 'arm', 'hand'],
      recipe,
      new Set(['torso:arm-socket'])
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);

    const finalDebug = logger.entries.find(
      (entry) =>
        entry.level === 'debug' &&
        entry.message.includes('Validation passed without issues')
    );
    expect(finalDebug).toBeDefined();
  });

  it('captures unexpected rule chain failures as validation errors', async () => {
    const executeSpy = jest
      .spyOn(ValidationRuleChain.prototype, 'execute')
      .mockImplementation(() => {
        throw new Error('forced failure');
      });

    const result = await validator.validateGraph(
      ['solo-root'],
      { constraints: {} },
      new Set()
    );

    expect(executeSpy).toHaveBeenCalled();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Validation error: forced failure'),
      ])
    );

    const errorLog = logger.entries.find(
      (entry) =>
        entry.level === 'error' &&
        entry.message.includes('Unexpected error during validation')
    );
    expect(errorLog).toBeDefined();
  });

  it('validates constructor dependencies', () => {
    expect(() => new GraphIntegrityValidator({ logger })).toThrow(
      InvalidArgumentError
    );
    expect(() => new GraphIntegrityValidator({ entityManager })).toThrow(
      InvalidArgumentError
    );
  });
});
