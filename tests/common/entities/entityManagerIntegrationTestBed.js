import EntityManager from '../../../src/entities/entityManager.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createMockSafeEventDispatcher,
} from '../mockFactories/index.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * @description Minimal test bed for integration tests requiring a real
 * {@link EntityManager} with an actual {@link InMemoryDataRegistry}.
 * @class
 */
export default class EntityManagerIntegrationTestBed extends BaseTestBed {
  /**
   * Constructs the integration test bed and EntityManager instance.
   *
   * @param {object} [entityManagerOptions] - Optional options forwarded to
   *   the EntityManager constructor.
   */
  constructor(entityManagerOptions = {}) {
    const mocks = {
      logger: createMockLogger(),
      validator: createMockSchemaValidator(),
      registry: new InMemoryDataRegistry(),
      eventDispatcher: createMockSafeEventDispatcher(),
    };
    super(mocks);

    this.entityManager = new EntityManager({
      registry: mocks.registry,
      validator: mocks.validator,
      logger: mocks.logger,
      dispatcher: mocks.eventDispatcher,
      ...entityManagerOptions,
    });
  }

  /**
   * Performs cleanup after each test run.
   *
   * @protected
   * @returns {Promise<void>} Resolves when cleanup completes.
   */
  async _afterCleanup() {
    if (this.entityManager?.clearAll) {
      this.entityManager.clearAll();
    }
    await super._afterCleanup();
  }
}
