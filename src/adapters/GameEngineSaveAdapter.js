/**
 * @file Adapter implementing ISaveService using GameEngine.
 */

import ISaveService from '../interfaces/ISaveService.js';

/** @typedef {import('../engine/gameEngine.js').default} GameEngine */

/**
 * @class GameEngineSaveAdapter
 * @description Thin adapter around GameEngine for saving.
 * @augments ISaveService
 */
export default class GameEngineSaveAdapter extends ISaveService {
  /** @type {GameEngine} */
  #engine;

  /**
   * Creates a new adapter instance.
   *
   * @param {GameEngine} engine - Game engine instance.
   */
  constructor(engine) {
    super();
    this.#engine = engine;
  }

  /** @inheritdoc */
  async save(slotId, name) {
    return this.#engine.triggerManualSave(name, slotId);
  }
}
