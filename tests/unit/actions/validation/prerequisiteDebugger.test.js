import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  DebugLevel,
  PrerequisiteDebugger,
} from '../../../../src/actions/validation/prerequisiteDebugger.js';
import { PrerequisiteEvaluationError } from '../../../../src/actions/validation/errors/prerequisiteEvaluationError.js';

const defaultTargets = { primary: { id: 'target' } };

/**
 * Create a logger mock that captures debug and error calls.
 *
 * @returns {{debug: jest.Mock, error: jest.Mock}} Logger mock implementation
 */
function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Build a lightweight entity manager mock with configurable data.
 *
 * @param {object} [options] - Options for the mock implementation
 * @param {Record<string, unknown>} [options.components] - Map of component keys to data
 * @param {Array<string>} [options.entityIds] - Entity IDs returned from getEntityIds
 * @param {Array<string>|Record<string, boolean>} [options.hasComponents] - Keys treated as existing components
 * @returns {{getComponentData: jest.Mock, getEntityIds: jest.Mock, hasComponent: jest.Mock}} Mock entity manager
 */
function buildEntityManager({
  components = {},
  entityIds = [],
  hasComponents = [],
} = {}) {
  const componentMap = new Map();
  Object.entries(components).forEach(([key, value]) => {
    componentMap.set(key, value);
  });

  const hasComponentSet = new Set();
  if (Array.isArray(hasComponents)) {
    hasComponents.forEach((key) => hasComponentSet.add(key));
  } else {
    Object.entries(hasComponents).forEach(([key, value]) => {
      if (value) {
        hasComponentSet.add(key);
      }
    });
  }

  return {
    getComponentData: jest.fn((entityId, componentType) =>
      componentMap.get(`${entityId}:${componentType}`)
    ),
    getEntityIds: jest.fn(() => new Set(entityIds)),
    hasComponent: jest.fn((entityId, componentType) => {
      const key = `${entityId}:${componentType}`;
      if (hasComponentSet.has(key)) {
        return true;
      }
      return componentMap.has(key);
    }),
  };
}

describe('PrerequisiteDebugger', () => {
  const baseContext = {
    actionId: 'action:test',
    prerequisiteIndex: 0,
    prerequisiteLogic: { always: [true] },
    evaluator: jest.fn(),
    context: {
      actor: { id: 'actor' },
      target: { id: 'target' },
      targets: defaultTargets,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs sanitized context when evaluation succeeds in debug mode', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager();
    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.DEBUG,
      entityManager,
    });

    const evaluator = jest.fn(() => true);

    const result = debuggerInstance.evaluate({
      ...baseContext,
      evaluator,
    });

    expect(result).toEqual({ success: true, result: true });
    expect(logger.debug).toHaveBeenCalledWith('Prerequisite evaluated', {
      actionId: baseContext.actionId,
      prerequisiteIndex: baseContext.prerequisiteIndex,
      logic: baseContext.prerequisiteLogic,
      result: true,
      context: {
        actor: 'actor',
        target: 'target',
        targets: ['primary'],
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('enriches errors with entity context and logs them', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager({
      components: {
        'actor:core:position': { locationId: 'room-1' },
        'target:core:position': { locationId: 'room-2' },
        'actor:anatomy:body': {
          body: {
            parts: {
              leftArm: 'part-1',
            },
          },
        },
        'part-1:anatomy:part': { subType: 'arm' },
      },
      entityIds: ['actor', 'target'],
    });

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('boom');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { hasPartOfType: ['actor', 'arm'] },
      evaluator,
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeInstanceOf(PrerequisiteEvaluationError);
    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: 'room-1',
      targetId: 'target',
      targetLocation: 'room-2',
      bodyParts: ['arm'],
    });
    expect(response.error.hint).toBe(
      'Review prerequisite logic and entity state above.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Prerequisite evaluation failed',
      response.error.toJSON()
    );
  });

  it('provides hint when actor lacks matching body parts', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager();

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('missing body');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { hasPartOfType: ['nonexistent', 'wing'] },
      evaluator,
    });

    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: null,
      targetId: 'target',
      targetLocation: null,
      bodyParts: [],
    });
    expect(response.error.hint).toBe(
      'Actor does not have any body parts of type "wing". Check anatomy:body component.'
    );
  });

  it('identifies when the actor is alone at a location', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager({
      components: {
        'actor:core:position': { locationId: 'room-1' },
      },
      entityIds: ['actor'],
    });

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('solo actor');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { hasOtherActorsAtLocation: [] },
      evaluator,
    });

    expect(entityManager.getEntityIds).toHaveBeenCalled();
    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: 'room-1',
      targetId: 'target',
      targetLocation: null,
      entitiesAtLocation: 1,
    });
    expect(response.error.hint).toBe(
      'Only the actor is at this location. Add other actors to the scene.'
    );
  });

  it('records when actor location is unknown', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager({ entityIds: ['actor'] });

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('no location');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { hasOtherActorsAtLocation: [] },
      evaluator,
    });

    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: null,
      targetId: 'target',
      targetLocation: null,
      entitiesAtLocation: 0,
    });
    expect(response.error.hint).toBe(
      'Review prerequisite logic and entity state above.'
    );
  });

  it('offers guidance when clothing slot is empty', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager();

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('no clothing');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { hasClothingInSlot: ['actor', 'head'] },
      evaluator,
    });

    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: null,
      targetId: 'target',
      targetLocation: null,
      wornItems: [],
    });
    expect(response.error.hint).toBe(
      'No clothing in slot "head". Add worn_items component with slot.'
    );
  });

  it('notes when a required component is missing from an entity', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager();

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('missing component');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { component_present: ['actor', 'core:inventory'] },
      evaluator,
    });

    expect(entityManager.hasComponent).toHaveBeenCalledWith(
      'actor',
      'core:inventory'
    );
    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: null,
      targetId: 'target',
      targetLocation: null,
      hasComponent: false,
    });
    expect(response.error.hint).toBe(
      'Entity missing component "core:inventory". Add component to entity.'
    );
  });

  it('falls back to default hint when component is present', () => {
    const logger = createLogger();
    const entityManager = buildEntityManager({
      hasComponents: ['actor:core:inventory'],
    });

    const debuggerInstance = new PrerequisiteDebugger({
      logger,
      debugLevel: DebugLevel.ERROR,
      entityManager,
    });

    const evaluator = jest.fn(() => {
      throw new Error('component issue');
    });

    const response = debuggerInstance.evaluate({
      ...baseContext,
      prerequisiteLogic: { component_present: ['actor', 'core:inventory'] },
      evaluator,
    });

    expect(response.error.entityState).toEqual({
      actorId: 'actor',
      actorLocation: null,
      targetId: 'target',
      targetLocation: null,
      hasComponent: true,
    });
    expect(response.error.hint).toBe(
      'Review prerequisite logic and entity state above.'
    );
  });
});
