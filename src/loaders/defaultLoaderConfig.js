// src/loaders/defaultLoaderConfig.js

/**
 * @file Provides a helper to create the default content loaders configuration.
 */

/** @typedef {import('../interfaces/coreServices.js').BaseManifestItemLoaderInterface} BaseManifestItemLoaderInterface */

/**
 * Structure describing a content loader configuration entry.
 *
 * @typedef {object} LoaderConfigEntry
 * @property {BaseManifestItemLoaderInterface} loader - Loader instance.
 * @property {string} contentKey - Key within the manifest's `content` section.
 * @property {string} diskFolder - Directory name under the mod root.
 * @property {string} registryKey - Registry key for the loaded content type.
 * @property {'definitions' | 'instances'} phase - Loading phase for the content type.
 */

/**
 * Converts a map of loader instances into the structured configuration array
 * used by {@link ModsLoader} and {@link ContentLoadManager}.
 *
 * @param {Record<string, BaseManifestItemLoaderInterface>} loaderMap - Map of
 * type name to loader instance.
 * @returns {LoaderConfigEntry[]} Array describing loader configuration.
 */
export function createContentLoadersConfig(loaderMap) {
  const meta = {
    components: {
      contentKey: 'components',
      diskFolder: 'components',
      phase: 'definitions',
    },
    events: {
      contentKey: 'events',
      diskFolder: 'events',
      phase: 'definitions',
    },
    conditions: {
      contentKey: 'conditions',
      diskFolder: 'conditions',
      phase: 'definitions',
    },
    macros: {
      contentKey: 'macros',
      diskFolder: 'macros',
      phase: 'definitions',
    },
    actions: {
      contentKey: 'actions',
      diskFolder: 'actions',
      phase: 'definitions',
    },
    rules: {
      contentKey: 'rules',
      diskFolder: 'rules',
      phase: 'definitions',
    },
    goals: {
      contentKey: 'goals',
      diskFolder: 'goals',
      phase: 'definitions',
    },
    entityDefinitions: {
      contentKey: 'entityDefinitions',
      diskFolder: 'entities/definitions',
      phase: 'definitions',
    },
    entityInstances: {
      contentKey: 'entityInstances',
      diskFolder: 'entities/instances',
      phase: 'instances',
    },
  };

  return Object.entries(loaderMap).map(([registryKey, loader]) => ({
    loader,
    registryKey,
    contentKey: meta[registryKey].contentKey,
    diskFolder: meta[registryKey].diskFolder,
    phase: meta[registryKey].phase,
  }));
}

/**
 * Creates the default loader configuration used by {@link ModsLoader} when a
 * custom configuration isn't supplied.
 *
 * @param {object} deps - Loader instances used to build the config.
 * @param {BaseManifestItemLoaderInterface} deps.componentDefinitionLoader - Component loader.
 * @param {BaseManifestItemLoaderInterface} deps.eventLoader - Event loader.
 * @param {BaseManifestItemLoaderInterface} deps.conditionLoader - Condition loader.
 * @param {BaseManifestItemLoaderInterface} deps.macroLoader - Macro loader.
 * @param {BaseManifestItemLoaderInterface} deps.actionLoader - Action loader.
 * @param {BaseManifestItemLoaderInterface} deps.ruleLoader - Rule loader.
 * @param {BaseManifestItemLoaderInterface} deps.goalLoader - Goal loader.
 * @param {BaseManifestItemLoaderInterface} deps.entityDefinitionLoader - Entity definition loader.
 * @param {BaseManifestItemLoaderInterface} deps.entityInstanceLoader - Entity instance loader.
 * @returns {LoaderConfigEntry[]} Array describing loader configuration.
 */
export function createDefaultContentLoadersConfig({
  componentDefinitionLoader,
  eventLoader,
  conditionLoader,
  macroLoader,
  actionLoader,
  ruleLoader,
  goalLoader,
  entityDefinitionLoader,
  entityInstanceLoader,
}) {
  return createContentLoadersConfig({
    components: componentDefinitionLoader,
    events: eventLoader,
    conditions: conditionLoader,
    macros: macroLoader,
    actions: actionLoader,
    rules: ruleLoader,
    goals: goalLoader,
    entityDefinitions: entityDefinitionLoader,
    entityInstances: entityInstanceLoader,
  });
}

export default createDefaultContentLoadersConfig;
