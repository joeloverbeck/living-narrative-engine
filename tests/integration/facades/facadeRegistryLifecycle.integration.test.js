import { describe, it, beforeEach, expect } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import EventBus from '../../../src/events/eventBus.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';
import { UnifiedCache } from '../../../src/cache/UnifiedCache.js';
import FacadeFactory from '../../../src/shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../../src/shared/facades/FacadeRegistry.js';
import BaseFacade from '../../../src/shared/facades/BaseFacade.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * @class InventoryTestFacade
 * @extends BaseFacade
 * @description Test facade that exercises cacheable inventory operations.
 */
class InventoryTestFacade extends BaseFacade {
  /**
   * @description Lists items for an entity using the base cache helper.
   * @param {string} entityId - Identifier for the entity being queried.
   * @returns {Promise<{success: boolean, items: Array<{id: string, name: string}>}>} Inventory payload.
   */
  async listItems(entityId) {
    return this.cacheableOperation(`inventory:${entityId}`, async () => {
      return {
        success: true,
        items: [
          {
            id: 'sword-of-testing',
            name: 'Sword of Testing',
          },
        ],
      };
    });
  }

  /**
   * @description Simulates equipping an item using the resilience helper.
   * @param {string} entityId - Identifier for the entity that equips the item.
   * @param {string} itemId - Identifier for the item being equipped.
   * @returns {Promise<{success: boolean, entityId: string, itemId: string}>} Operation outcome.
   */
  async equip(entityId, itemId) {
    return this.executeWithResilience('equip', async () => ({
      success: true,
      entityId,
      itemId,
    }));
  }
}

/**
 * @class MovementTestFacade
 * @extends BaseFacade
 * @description Test facade that uses resilience helpers for movement operations.
 */
class MovementTestFacade extends BaseFacade {
  /**
   * @description Moves an entity in a direction through the resilience pipeline.
   * @param {string} entityId - Identifier for the entity moving.
   * @param {string} direction - Cardinal direction of movement.
   * @returns {Promise<{success: boolean, entityId: string, direction: string}>} Movement result payload.
   */
  async move(entityId, direction) {
    return this.executeWithResilience('move', async () => ({
      success: true,
      entityId,
      direction,
    }));
  }
}

/**
 * @class BrokenFacade
 * @extends BaseFacade
 * @description Test facade that intentionally throws during construction.
 */
class BrokenFacade extends BaseFacade {
  /**
   * @description Forwards dependencies then throws to simulate construction failure.
   * @param {object} deps - Dependencies forwarded to the base facade constructor.
   */
  constructor(deps) {
    super(deps);
    throw new Error('broken facade');
  }
}

/**
 * @description Flushes pending asynchronous event bus work.
 * @returns {Promise<void>} Promise resolved on the next event loop turn.
 */
const flushAsyncEvents = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FacadeRegistry lifecycle integration with production services', () => {
  let container;
  let logger;
  let eventBus;
  let cache;
  let factory;
  let registry;
  /** @type {{ type: string, payload: any }[]} */
  let recordedEvents;

  /**
   * @description Registers the primary test facades with shared metadata.
   * @returns {void}
   */
  const registerTestFacades = () => {
    registry.register(
      {
        name: 'InventoryFacade',
        version: '1.0.0',
        category: 'inventory',
        description: 'Inventory operations',
        capabilities: ['list', 'equip'],
        tags: ['inventory', 'core'],
      },
      {
        name: 'InventoryFacade',
      }
    );

    registry.register(
      {
        name: 'MovementFacade',
        version: '1.0.0',
        category: 'movement',
        description: 'Movement operations',
        capabilities: ['move'],
        tags: ['movement'],
        singleton: false,
      },
      {
        name: 'MovementFacade',
        singleton: false,
      }
    );
  };

  beforeEach(() => {
    logger = new NoOpLogger();
    eventBus = new EventBus({ logger });
    cache = new UnifiedCache({ logger }, { enableMetrics: false });

    container = new AppContainer();
    container.register('ILogger', logger);
    container.register('IEventBus', eventBus);
    container.register('IUnifiedCache', cache);

    container.register('InventoryFacade', () => InventoryTestFacade, {
      lifecycle: 'transient',
    });

    container.register('MovementFacade', () => MovementTestFacade, {
      lifecycle: 'transient',
    });

    container.register('BrokenFacade', () => BrokenFacade, {
      lifecycle: 'transient',
    });

    factory = new FacadeFactory({ container, logger, registry: null });
    registry = new FacadeRegistry({ logger, eventBus, facadeFactory: factory });

    recordedEvents = [];
    eventBus.subscribe('*', async (event) => {
      recordedEvents.push(event);
    });
  });

  it('registers facades, exposes metadata, and supports discovery operations', async () => {
    registerTestFacades();
    await flushAsyncEvents();

    expect(registry.isRegistered('InventoryFacade')).toBe(true);
    expect(registry.isRegistered('MovementFacade')).toBe(true);

    const inventoryFacade = registry.getFacade('InventoryFacade');
    const secondaryInventoryInstance = registry.getFacade('InventoryFacade');
    expect(secondaryInventoryInstance).toBe(inventoryFacade);

    const nonSingletonMovement = registry.getFacade('MovementFacade', { singleton: false });
    const otherNonSingletonMovement = registry.getFacade('MovementFacade', { singleton: false });
    expect(otherNonSingletonMovement).not.toBe(nonSingletonMovement);

    const inventoryResult = await inventoryFacade.listItems('hero-1');
    expect(inventoryResult.success).toBe(true);
    expect(inventoryResult.items[0].name).toBe('Sword of Testing');

    const cachedInventory = await inventoryFacade.listItems('hero-1');
    expect(cachedInventory).toEqual(inventoryResult);

    const movementResult = await nonSingletonMovement.move('hero-1', 'north');
    expect(movementResult).toEqual({ success: true, entityId: 'hero-1', direction: 'north' });

    const registrationEvents = recordedEvents.filter((event) => event.type === 'FACADE_REGISTERED');
    expect(registrationEvents).toHaveLength(2);
    expect(registrationEvents.map((event) => event.payload.name)).toEqual(
      expect.arrayContaining(['InventoryFacade', 'MovementFacade'])
    );

    const inventoryMetadata = registry.getMetadata('InventoryFacade');
    expect(inventoryMetadata.registeredAt).toBeInstanceOf(Date);
    expect(inventoryMetadata.category).toBe('inventory');
    expect(inventoryMetadata.singleton).toBe(true);

    expect(registry.getMetadata('UnknownFacade')).toBeNull();

    const allFacades = registry.getAllFacades();
    expect(allFacades).toHaveLength(2);
    expect(registry.getRegisteredFacades()).toHaveLength(2);

    const categories = registry.getCategories();
    expect(categories).toEqual(expect.arrayContaining(['inventory', 'movement']));

    expect(registry.getFacadesByCategory('inventory').map((facade) => facade.name)).toEqual([
      'InventoryFacade',
    ]);
    expect(registry.getFacadesByCategory('missing-category')).toEqual([]);

    expect(registry.getCapabilities('InventoryFacade')).toEqual(['list', 'equip']);
    expect(registry.getCapabilities('Unregistered')).toEqual([]);

    expect(registry.getTags('InventoryFacade')).toEqual(['inventory', 'core']);
    expect(registry.getTags('Unregistered')).toEqual([]);

    const facadeInfo = registry.getFacadeInfo('InventoryFacade');
    expect(facadeInfo).toMatchObject({
      name: 'InventoryFacade',
      version: '1.0.0',
      capabilities: ['list', 'equip'],
      tags: ['inventory', 'core'],
    });
    expect(facadeInfo.config).toMatchObject({ name: 'InventoryFacade' });
    expect(registry.getFacadeInfo('NonExistent')).toBeNull();

    expect(registry.searchByTags('movement').map((facade) => facade.name)).toEqual(['MovementFacade']);
    expect(registry.searchByTags(['inventory', 'core'], true).map((facade) => facade.name)).toEqual([
      'InventoryFacade',
    ]);
    expect(registry.searchByTags([])).toEqual([]);
    expect(registry.searchByTags(null)).toEqual([]);

    expect(registry.findByCapabilities('move').map((facade) => facade.name)).toEqual(['MovementFacade']);
    expect(registry.findByCapabilities()).toHaveLength(2);
    expect(registry.findByCapabilities('non-existent')).toEqual([]);

    const statistics = registry.getStatistics();
    expect(statistics.totalFacades).toBe(2);
    expect(statistics.categories).toBe(2);
    expect(statistics.singletonInstances).toBe(1);
    expect(statistics.facadesByCategory.inventory).toBe(1);
    expect(statistics.facadesByCategory.movement).toBe(1);

    expect(() =>
      registry.register(
        {
          name: 'InventoryFacade',
          version: '1.0.0',
        },
        { name: 'InventoryFacade' }
      )
    ).toThrow(new InvalidArgumentError('Facade InventoryFacade is already registered'));
  });

  it('manages singleton lifecycle and unregisters facades', () => {
    registerTestFacades();

    const initialInventory = registry.getFacade('InventoryFacade');
    expect(initialInventory).toBeInstanceOf(InventoryTestFacade);
    expect(registry.getStatistics().singletonInstances).toBe(1);

    registry.clearSingleton('InventoryFacade');
    expect(registry.getStatistics().singletonInstances).toBe(0);

    const rehydratedInventory = registry.getFacade('InventoryFacade');
    expect(rehydratedInventory).toBeInstanceOf(InventoryTestFacade);
    expect(registry.getStatistics().singletonInstances).toBe(1);

    registry.clearSingleton('UnknownFacade');

    const initialMovement = registry.getFacade('MovementFacade');
    expect(initialMovement).toBeInstanceOf(MovementTestFacade);
    expect(registry.getStatistics().singletonInstances).toBe(2);

    registry.clearAllSingletons();
    expect(registry.getStatistics().singletonInstances).toBe(0);

    const movementAfterClear = registry.getFacade('MovementFacade');
    expect(movementAfterClear).toBeInstanceOf(MovementTestFacade);
    expect(registry.getStatistics().singletonInstances).toBe(1);

    registry.unregister('MovementFacade');
    expect(registry.isRegistered('MovementFacade')).toBe(false);
    expect(registry.getFacadesByCategory('movement')).toEqual([]);

    const statsAfterUnregister = registry.getStatistics();
    expect(statsAfterUnregister.totalFacades).toBe(1);
    expect(statsAfterUnregister.facadesByCategory.movement).toBeUndefined();

    expect(() => registry.getFacade('MovementFacade')).toThrow(
      new InvalidArgumentError('Facade MovementFacade is not registered')
    );
  });

  it('validates metadata before registering facades', () => {
    expect(() => registry.register(null, {})).toThrow(
      new InvalidArgumentError('Facade metadata must be an object')
    );

    expect(() => registry.register({}, {})).toThrow(
      new InvalidArgumentError('Facade name is required')
    );

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: 100,
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade version is required'));

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: '1.0.0',
          category: 42,
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade category must be a string'));

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: '1.0.0',
          description: 100,
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade description must be a string'));

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: '1.0.0',
          tags: 'invalid',
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade tags must be an array'));

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: '1.0.0',
          capabilities: 'invalid',
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade capabilities must be an array'));

    expect(() =>
      registry.register(
        {
          name: 'InvalidFacade',
          version: '1.0.0',
          singleton: 'yes',
        },
        {}
      )
    ).toThrow(new InvalidArgumentError('Facade singleton flag must be boolean'));
  });

  it('wraps facade creation failures from the factory', async () => {
    registry.register(
      {
        name: 'BrokenFacade',
        version: '1.0.0',
        category: 'broken',
        description: 'Fails during construction',
      },
      {
        name: 'BrokenFacade',
      }
    );

    await flushAsyncEvents();

    const metadata = registry.getMetadata('BrokenFacade');
    expect(metadata.capabilities).toEqual([]);
    expect(metadata.tags).toEqual([]);

    expect(() => registry.getFacade('BrokenFacade')).toThrow(
      new InvalidArgumentError(
        'Failed to get facade BrokenFacade: Failed to create facade BrokenFacade: Failed to create facade BrokenFacade: broken facade'
      )
    );
  });
});
