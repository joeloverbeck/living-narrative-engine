/**
 * @file Adapter implementing ILoadService using GameEngine.
 */

import ILoadService from '../interfaces/ILoadService.js';

/** @typedef {import('../engine/gameEngine.js').default} GameEngine */

/**
 * @class GameEngineLoadAdapter
 * @description Thin adapter around GameEngine for loading saves.
 * @augments ILoadService
 */
export default class GameEngineLoadAdapter extends ILoadService {
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
  async load(identifier) {
    return this.#engine.loadGame(identifier);
  }
}
