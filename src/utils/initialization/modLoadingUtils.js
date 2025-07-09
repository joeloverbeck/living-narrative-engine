// src/utils/initialization/modLoadingUtils.js

/**
 * @description Loads mods from the game configuration file
 * @param {ModsLoader} modsLoader - The mods loader service instance
 * @param {ILogger} logger - The logger instance
 * @param {string} [worldName] - The world name to load mods for
 * @returns {Promise<object>} The load report from the mods loader
 * @throws {Error} If game configuration fails to load
 */
export async function loadModsFromGameConfig(
  modsLoader,
  logger,
  worldName = 'default'
) {
  try {
    // Load game configuration
    const gameConfigResponse = await fetch('./data/game.json');
    if (!gameConfigResponse.ok) {
      throw new Error(
        `Failed to load game configuration: ${gameConfigResponse.status} ${gameConfigResponse.statusText}`
      );
    }

    const gameConfig = await gameConfigResponse.json();
    const requestedMods = gameConfig.mods || [];

    logger.info(
      `Loading ${requestedMods.length} mods for world '${worldName}': ${requestedMods.join(', ')}`
    );

    // Load all mods and their dependencies
    const loadReport = await modsLoader.loadMods(worldName, requestedMods);

    logger.info(
      `Successfully loaded ${loadReport.finalModOrder.length} mods for world '${worldName}'`
    );
    logger.debug('Mod load report:', loadReport);

    return loadReport;
  } catch (error) {
    logger.error(`Failed to load mods for world '${worldName}':`, error);
    throw error;
  }
}
