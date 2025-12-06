import { describe, it, expect } from '@jest/globals';
import { SpatialIndexSynchronizer } from '../../../src/entities/spatialIndexSynchronizer.js';
import SpatialIndexManager from '../../../src/entities/spatialIndexManager.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(...args) {
    this.debugEntries.push(args);
  }

  info(...args) {
    this.infoEntries.push(args);
  }

  warn(...args) {
    this.warnEntries.push(args);
  }

  error(...args) {
    this.errorEntries.push(args);
  }
}

class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  validate(schemaId, payload) {
    if (!this.schemas.has(schemaId)) {
      return { isValid: true, errors: [] };
    }
    const entry = this.schemas.get(schemaId);
    if (typeof entry === 'function') {
      return entry(schemaId, payload);
    }
    return entry;
  }
}

class TrackingSpatialIndex extends SpatialIndexManager {
  constructor(deps) {
    super(deps);
    this.buildIndexCalls = 0;
    this.manualAdditions = 0;
    this.clearIndexCalls = 0;
    this.lastUpdate = null;
    this._inBuildIndex = false;
  }

  buildIndex(entityManager) {
    this.buildIndexCalls += 1;
    this._inBuildIndex = true;
    try {
      super.buildIndex(entityManager);
    } finally {
      this._inBuildIndex = false;
    }
  }

  addEntity(entityId, locationId) {
    if (!this._inBuildIndex) {
      this.manualAdditions += 1;
    }
    super.addEntity(entityId, locationId);
  }

  clearIndex() {
    this.clearIndexCalls += 1;
    super.clearIndex();
  }

  updateEntityLocation(entityId, oldLocationId, newLocationId) {
    this.lastUpdate = { entityId, oldLocationId, newLocationId };
    super.updateEntityLocation(entityId, oldLocationId, newLocationId);
  }
}

const registerSpatialEventDefinitions = (registry) => {
  [
    ENTITY_CREATED_ID,
    ENTITY_REMOVED_ID,
    COMPONENT_ADDED_ID,
    COMPONENT_REMOVED_ID,
  ].forEach((eventId) => {
    registry.store('events', eventId, {
      id: eventId,
      name: eventId,
      description: 'spatial-index-integration-event',
    });
  });
};

const createEntity = (id, locationId, { componentData } = {}) => ({
  id,
  getComponentData(componentId) {
    if (componentId !== POSITION_COMPONENT_ID) {
      return undefined;
    }

    if (componentData) {
      return componentData;
    }

    if (locationId === undefined) {
      return undefined;
    }

    return { locationId };
  },
});

const createEnvironment = ({ entityManager, spatialIndexFactory } = {}) => {
  const logger = new RecordingLogger();
  const registry = new InMemoryDataRegistry({ logger });
  registerSpatialEventDefinitions(registry);
  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });
  const spatialIndex = spatialIndexFactory
    ? spatialIndexFactory({ logger })
    : new SpatialIndexManager({ logger });

  const synchronizer = new SpatialIndexSynchronizer({
    spatialIndexManager: spatialIndex,
    safeEventDispatcher,
    logger,
    entityManager,
  });

  return {
    logger,
    registry,
    eventBus,
    safeEventDispatcher,
    spatialIndex,
    synchronizer,
  };
};

const getEntityIdsAtLocation = (spatialIndex, locationId) =>
  Array.from(spatialIndex.getEntitiesInLocation(locationId));

const logIncludes = (entries, snippet) =>
  entries.some((args) =>
    args.some((value) => typeof value === 'string' && value.includes(snippet))
  );

describe('SpatialIndexSynchronizer integration', () => {
  it('bootstraps iterables using SpatialIndexManager.buildIndex and tracks removals', async () => {
    const iteratedEntities = [
      createEntity('entity-alpha', 'alpha'),
      createEntity('entity-beta', 'beta'),
    ];
    const environment = createEnvironment({
      entityManager: { entities: iteratedEntities },
      spatialIndexFactory: ({ logger }) => new TrackingSpatialIndex({ logger }),
    });

    expect(environment.spatialIndex.buildIndexCalls).toBe(1);
    expect(environment.spatialIndex.manualAdditions).toBe(0);
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'alpha')).toEqual([
      'entity-alpha',
    ]);
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'beta')).toEqual([
      'entity-beta',
    ]);

    await environment.safeEventDispatcher.dispatch(ENTITY_REMOVED_ID, {
      instanceId: 'entity-alpha',
    });

    expect(getEntityIdsAtLocation(environment.spatialIndex, 'alpha')).toEqual(
      []
    );
    expect(
      logIncludes(
        environment.logger.debugEntries,
        'SpatialSync: Removed entity-alpha from index at alpha'
      )
    ).toBe(true);
  });

  it('bootstraps from component queries when entities are not iterable', () => {
    const entityManager = {
      getEntitiesWithComponent() {
        return [
          createEntity('  ', 'theta'),
          createEntity('entity-gamma', '  '),
          createEntity('entity-delta', undefined),
          createEntity('entity-theta', 'theta'),
        ];
      },
    };

    const environment = createEnvironment({
      entityManager,
      spatialIndexFactory: ({ logger }) => new TrackingSpatialIndex({ logger }),
    });

    expect(environment.spatialIndex.buildIndexCalls).toBe(0);
    expect(environment.spatialIndex.clearIndexCalls).toBe(1);
    expect(environment.spatialIndex.manualAdditions).toBe(1);
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'theta')).toEqual([
      'entity-theta',
    ]);
  });

  it('logs when no entity manager is provided for bootstrap', () => {
    const environment = createEnvironment();

    expect(
      logIncludes(
        environment.logger.debugEntries,
        'No entity manager provided, skipping bootstrap'
      )
    ).toBe(true);
  });

  it('warns and short-circuits when the entity manager cannot be iterated', () => {
    const environment = createEnvironment({ entityManager: {} });

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'Provided entity manager cannot be iterated'
      )
    ).toBe(true);
  });

  it('warns when bootstrap seed source is not iterable', () => {
    const environment = createEnvironment({
      entityManager: {
        getEntitiesWithComponent() {
          return { note: 'not-iterable' };
        },
      },
    });

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'Unable to iterate existing entities during bootstrap'
      )
    ).toBe(true);
  });

  it('logs errors thrown while bootstrapping existing entities', () => {
    const erroringEntityManager = {
      getEntitiesWithComponent() {
        throw new Error('bootstrap-failure');
      },
    };

    const environment = createEnvironment({
      entityManager: erroringEntityManager,
    });

    expect(
      environment.logger.errorEntries.some(
        ([message, error]) =>
          typeof message === 'string' &&
          message.includes(
            'Failed to bootstrap spatial index from existing entities'
          ) &&
          error instanceof Error &&
          error.message === 'bootstrap-failure'
      )
    ).toBe(true);
  });

  it('adds new entities to the spatial index when they include a position', async () => {
    const environment = createEnvironment();
    const entity = createEntity('entity-new', ' gamma ');

    await environment.safeEventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
    });

    expect(getEntityIdsAtLocation(environment.spatialIndex, 'gamma')).toEqual([
      'entity-new',
    ]);
  });

  it('skips indexing when entity creation payload is invalid', async () => {
    const environment = createEnvironment();

    await environment.safeEventDispatcher.dispatch(
      ENTITY_CREATED_ID,
      'invalid-payload'
    );

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'SpatialIndexSynchronizer.onEntityAdded: Invalid payload received'
      )
    ).toBe(true);
  });

  it('skips removal when the entity location is unknown', async () => {
    const environment = createEnvironment();

    await environment.safeEventDispatcher.dispatch(ENTITY_REMOVED_ID, {
      instanceId: 'missing-entity',
    });

    expect(
      logIncludes(
        environment.logger.debugEntries,
        'had no tracked location, skipping removal'
      )
    ).toBe(true);
  });

  it('warns when entity removal payload is invalid', async () => {
    const environment = createEnvironment();

    await environment.safeEventDispatcher.dispatch(
      ENTITY_REMOVED_ID,
      'invalid-payload'
    );

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'SpatialIndexSynchronizer.onEntityRemoved: Invalid payload received'
      )
    ).toBe(true);
  });

  it('ignores component changes that are not position updates', async () => {
    const environment = createEnvironment({
      spatialIndexFactory: ({ logger }) => new TrackingSpatialIndex({ logger }),
    });
    const entity = createEntity('entity-component', 'zeta');

    await environment.safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: 'not:position',
      componentData: { locationId: 'unused' },
    });

    expect(environment.spatialIndex.lastUpdate).toBe(null);
  });

  it('warns when position change payload is invalid', async () => {
    const environment = createEnvironment();

    await environment.safeEventDispatcher.dispatch(
      COMPONENT_ADDED_ID,
      'invalid-payload'
    );

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'SpatialIndexSynchronizer.onPositionChanged: Invalid payload received'
      )
    ).toBe(true);
  });

  it('warns when a position change contains an invalid entity id', async () => {
    const environment = createEnvironment();

    await environment.safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity: createEntity('   ', 'ignored'),
      componentTypeId: POSITION_COMPONENT_ID,
      componentData: { locationId: 'ignored' },
      oldComponentData: { locationId: 'ignored' },
    });

    expect(
      logIncludes(
        environment.logger.warnEntries,
        'SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID'
      )
    ).toBe(true);
  });

  it('bails out when the position did not change effectively', async () => {
    const environment = createEnvironment({
      spatialIndexFactory: ({ logger }) => new TrackingSpatialIndex({ logger }),
    });
    const entity = createEntity('entity-static', 'omega');

    await environment.safeEventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
    });

    environment.spatialIndex.lastUpdate = null;

    await environment.safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: POSITION_COMPONENT_ID,
      componentData: { locationId: 'omega' },
      oldComponentData: { locationId: 'omega' },
    });

    expect(environment.spatialIndex.lastUpdate).toBe(null);
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'omega')).toEqual([
      'entity-static',
    ]);
  });

  it('updates spatial index when a tracked entity moves to a new location', async () => {
    const environment = createEnvironment({
      spatialIndexFactory: ({ logger }) => new TrackingSpatialIndex({ logger }),
    });
    const entity = createEntity('entity-move', 'alpha');

    await environment.safeEventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
    });

    await environment.safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: POSITION_COMPONENT_ID,
      componentData: { locationId: 'beta' },
      oldComponentData: { locationId: 'alpha' },
    });

    expect(environment.spatialIndex.lastUpdate).toEqual({
      entityId: 'entity-move',
      oldLocationId: 'alpha',
      newLocationId: 'beta',
    });
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'alpha')).toEqual(
      []
    );
    expect(getEntityIdsAtLocation(environment.spatialIndex, 'beta')).toEqual([
      'entity-move',
    ]);
  });

  it('removes spatial tracking when the position component is removed', async () => {
    const environment = createEnvironment();
    const entity = createEntity('entity-remove', 'gamma');

    await environment.safeEventDispatcher.dispatch(ENTITY_CREATED_ID, {
      entity,
    });

    await environment.safeEventDispatcher.dispatch(COMPONENT_REMOVED_ID, {
      entity,
      componentTypeId: POSITION_COMPONENT_ID,
      oldComponentData: { locationId: 'gamma' },
    });

    expect(getEntityIdsAtLocation(environment.spatialIndex, 'gamma')).toEqual(
      []
    );
  });
});
