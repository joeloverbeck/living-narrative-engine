/**
 * @file Interface for GamePersistenceService
 * @description Game state persistence service interface for save/load operations
 */

/**
 * @typedef {object} IGamePersistenceService
 * @property {function(): Promise<void>} save - Save current game state
 * @property {function(): Promise<void>} load - Load saved game state
 */

export {};
