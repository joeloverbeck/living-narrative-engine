import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../../src/anatomy/bodyGraphService.js';
import { HasPartOfTypeOperator } from '../../../../src/logic/operators/hasPartOfTypeOperator.js';
import { HasPartWithComponentValueOperator } from '../../../../src/logic/operators/hasPartWithComponentValueOperator.js';
import { HasPartOfTypeWithComponentValueOperator } from '../../../../src/logic/operators/hasPartOfTypeWithComponentValueOperator.js';
import { BaseBodyPartOperator } from '../../../../src/logic/operators/base/BaseBodyPartOperator.js';

class InMemoryEntityManager {
  constructor() {
    this.entities = new Map();
    this.componentIndex = new Map();
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    const componentData = this.#clone(data);
    this.entities.get(entityId).set(componentId, componentData);

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }
    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const component = entity.get(componentId);
    return component !== undefined ? this.#clone(component) : null;
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index.values()).map((entry) => ({ ...entry }));
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

describe('Body part JSON Logic operators with real BodyGraphService', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let bodyGraphService;
  let hasPartOfType;
  let hasPartWithComponentValue;
  let hasPartOfTypeWithComponentValue;
  let actorId;
  let context;
  let rootlessActorId;
  let observerId;
  let torsoId;

  beforeEach(async () => {
    entityManager = new InMemoryEntityManager();
    logger = createLogger();
    eventDispatcher = createEventDispatcher();

    actorId = 'actor-operator';
    torsoId = 'torso-operator';
    const leftArmId = 'arm-left-operator';
    const rightArmId = 'arm-right-operator';
    const leftLegId = 'leg-left-operator';
    const visorId = 'visor-operator';

    entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:humanoid',
      root: torsoId,
      body: { root: torsoId },
      structure: { rootPartId: torsoId },
    });

    entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
    entityManager.addComponent(torsoId, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'core-spine',
    });

    entityManager.addComponent(leftArmId, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(leftArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'shoulder-left',
    });
    entityManager.addComponent(leftArmId, 'anatomy:status', {
      posture: { state: 'braced' },
    });

    entityManager.addComponent(rightArmId, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(rightArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'shoulder-right',
    });
    entityManager.addComponent(rightArmId, 'equipment:grip', {
      itemId: 'sword-operator',
    });

    entityManager.addComponent(leftLegId, 'anatomy:part', { subType: 'leg' });
    entityManager.addComponent(leftLegId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'hip-left',
    });
    entityManager.addComponent(leftLegId, 'appearance:color', {
      primary: 'blue',
    });

    entityManager.addComponent(visorId, 'anatomy:part', { subType: 'headgear' });
    entityManager.addComponent(visorId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'head-slot',
    });
    entityManager.addComponent(visorId, 'equipment:details', {
      opacity: { level: 'transparent' },
    });

    observerId = 'observer-entity';
    entityManager.addComponent(observerId, 'core:description', { text: 'observer' });

    rootlessActorId = 'rootless-actor';
    entityManager.addComponent(rootlessActorId, 'anatomy:body', {
      recipeId: 'test:rootless',
      body: {},
    });

    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    await bodyGraphService.buildAdjacencyCache(actorId);

    hasPartOfType = new HasPartOfTypeOperator({
      entityManager,
      bodyGraphService,
      logger,
    });
    hasPartWithComponentValue = new HasPartWithComponentValueOperator({
      entityManager,
      bodyGraphService,
      logger,
    });
    hasPartOfTypeWithComponentValue =
      new HasPartOfTypeWithComponentValueOperator({
        entityManager,
        bodyGraphService,
        logger,
      });

    context = {
      actor: { id: actorId },
      actorId,
      entity: { id: actorId },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws if required dependencies are missing', () => {
    expect(() => new HasPartOfTypeOperator({ entityManager, logger })).toThrow(
      'BaseBodyPartOperator: Missing required dependencies'
    );
  });

  it('returns true when the actor has a matching part type', () => {
    const buildSpy = jest.spyOn(bodyGraphService, 'buildAdjacencyCache');

    const result = hasPartOfType.evaluate(['actor', 'leg'], context);

    expect(result).toBe(true);
    expect(buildSpy).toHaveBeenCalledWith(torsoId);
  });

  it('supports resolving entity IDs from primitive context paths', () => {
    const result = hasPartOfType.evaluate(['actorId', 'arm'], context);
    expect(result).toBe(true);
  });

  it('returns false when the part type is not present', () => {
    const result = hasPartOfType.evaluate(['actor', 'tail'], context);
    expect(result).toBe(false);
  });

  it('returns false when parameters are invalid', () => {
    const result = hasPartOfType.evaluate([], context);
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid parameters')
    );
  });

  it('logs a warning when no entity can be resolved from the context', () => {
    const result = hasPartOfType.evaluate(['missing.path', 'arm'], {});
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No entity found at path missing.path')
    );
  });

  it('logs a warning when the resolved entity lacks an ID', () => {
    const result = hasPartOfType.evaluate(['actor', 'arm'], { actor: '' });
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid entity at path actor')
    );
  });

  it('returns false when the entity lacks an anatomy body component', () => {
    const result = hasPartOfType.evaluate(['observer', 'arm'], {
      observer: { id: observerId },
    });
    expect(result).toBe(false);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Entity observer-entity has no anatomy:body component')
      )
    ).toBe(true);
  });

  it('returns false when the body component lacks a root reference', () => {
    const result = hasPartOfType.evaluate(['rootless', 'arm'], {
      rootless: { id: rootlessActorId },
    });
    expect(result).toBe(false);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes(
          'hasPartOfType: Entity rootless-actor has no anatomy:body component'
        )
      )
    ).toBe(true);
  });

  it('evaluates nested component values using HasPartWithComponentValueOperator', () => {
    const found = hasPartWithComponentValue.evaluate(
      ['actor', 'anatomy:status', 'posture.state', 'braced'],
      context
    );
    expect(found).toBe(true);

    const missing = hasPartWithComponentValue.evaluate(
      ['actor', 'anatomy:status', 'posture.state', 'asleep'],
      context
    );
    expect(missing).toBe(false);
  });

  it('evaluates type and component combinations end-to-end', () => {
    const match = hasPartOfTypeWithComponentValue.evaluate(
      ['actor', 'arm', 'equipment:grip', 'itemId', 'sword-operator'],
      context
    );
    expect(match).toBe(true);

    const noMatch = hasPartOfTypeWithComponentValue.evaluate(
      ['actor', 'arm', 'equipment:grip', 'itemId', 'shield'],
      context
    );
    expect(noMatch).toBe(false);
  });

  it('handles property paths that require deep traversal', () => {
    const match = hasPartOfTypeWithComponentValue.evaluate(
      ['actor', 'headgear', 'equipment:details', 'opacity.level', 'transparent'],
      context
    );
    expect(match).toBe(true);
  });

  it('gracefully handles evaluation errors from subclasses', () => {
    class ThrowingOperator extends BaseBodyPartOperator {
      constructor(deps) {
        super(deps, 'throwingOperator');
      }

      evaluateInternal() {
        throw new Error('unexpected failure');
      }
    }

    const throwingOperator = new ThrowingOperator({
      entityManager,
      bodyGraphService,
      logger,
    });

    const result = throwingOperator.evaluate(['actor', 'anything'], context);

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('throwingOperator: Error during evaluation'),
      expect.any(Error)
    );
  });
});
