/**
 * @file Mixin providing helper methods for configuring entity data.
 */

import { createDefaultActors } from './testActors.js';

/**
 * @description Extends a base test bed with entity setup utilities.
 * @param {typeof import('../baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('../baseTestBed.js').default} Extended class with entity helpers.
 */
export function EntitySetupMixin(Base) {
  return class EntitySetup extends Base {
    /**
     * Populates the mocked entity manager's activeEntities map.
     *
     * @param {...{ id: string }} entities - Entities to add.
     * @returns {void}
     */
    setActiveEntities(...entities) {
      const map = this.entityManager.activeEntities;
      map.clear();
      if (entities.length === 0) return;
      for (const e of entities) {
        map.set(e.id, e);
      }
    }

    /**
     * Adds a set of default actors to the mocked entity manager.
     *
     * @returns {{ ai1: object, ai2: object, player: object }} Object containing the created actors.
     */
    addDefaultActors() {
      const actors = createDefaultActors();
      this.setActiveEntities(actors.ai1, actors.ai2, actors.player);
      return actors;
    }

    /**
     * Configures the turn order service to return the provided actor next.
     *
     * @param {object} actor - Actor entity to return.
     * @returns {void}
     */
    mockNextActor(actor) {
      this.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      this.mocks.turnOrderService.getNextEntity.mockResolvedValue(actor);
    }

    /**
     * Configures the turn order service to return the provided actors sequentially.
     *
     * @param {...object} actors - Actor entities to return in order.
     * @returns {void}
     */
    mockActorSequence(...actors) {
      if (actors.length === 0) {
        this.mockEmptyQueue();
        return;
      }
      this.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      let index = 0;
      this.mocks.turnOrderService.getNextEntity.mockImplementation(() =>
        Promise.resolve(index < actors.length ? actors[index++] : null)
      );
    }

    /**
     * Configures the turn order service to represent an empty queue.
     *
     * @returns {void}
     */
    mockEmptyQueue() {
      this.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
      this.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);
    }
  };
}

export default EntitySetupMixin;
