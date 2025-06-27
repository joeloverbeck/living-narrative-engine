/**
 * @file Defines the contract for a service that loads mods for a world.
 */

/**
 * @typedef {object} IModsLoader
 * @property {(worldName: string, requestedModIds?: string[]) => Promise<import('./loadContracts.js').LoadReport>} loadMods
 * Loads mods for the specified world and returns a load report.
 */

export {};
