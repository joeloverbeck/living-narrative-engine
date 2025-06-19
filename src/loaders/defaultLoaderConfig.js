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
 * @property {string} contentTypeDir - Directory name under the mod root.
 * @property {string} typeName - Registry key for the loaded content type.
 */

/**
 * Converts a map of loader instances into the structured configuration array
 * used by {@link WorldLoader} and {@link ContentLoadManager}.
 *
 * @param {Record<string, BaseManifestItemLoaderInterface>} loaderMap - Map of
 * type name to loader instance.
 * @returns {LoaderConfigEntry[]} Array describing loader configuration.
 */
export function createContentLoadersConfig(loaderMap) {
  const meta = {
    components: { contentKey: 'components', contentTypeDir: 'components' },
    events: { contentKey: 'events', contentTypeDir: 'events' },
    conditions: { contentKey: 'conditions', contentTypeDir: 'conditions' },
    macros: { contentKey: 'macros', contentTypeDir: 'macros' },
    actions: { contentKey: 'actions', contentTypeDir: 'actions' },
    rules: { contentKey: 'rules', contentTypeDir: 'rules' },
    entityDefinitions: {
      contentKey: 'entityDefinitions',
      contentTypeDir: 'entities/definitions',
    },
    entityInstances: {
      contentKey: 'entityInstances',
      contentTypeDir: 'entities/instances',
    },
  };

  return Object.entries(loaderMap).map(([typeName, loader]) => ({
    loader,
    typeName,
    contentKey: meta[typeName].contentKey,
    contentTypeDir: meta[typeName].contentTypeDir,
  }));
}

/**
 * Creates the default loader configuration used by {@link WorldLoader} when a
 * custom configuration isn't supplied.
 *
 * @param {object} deps - Loader instances used to build the config.
 * @param {BaseManifestItemLoaderInterface} deps.componentDefinitionLoader - Component loader.
 * @param {BaseManifestItemLoaderInterface} deps.eventLoader - Event loader.
 * @param {BaseManifestItemLoaderInterface} deps.conditionLoader - Condition loader.
 * @param {BaseManifestItemLoaderInterface} deps.macroLoader - Macro loader.
 * @param {BaseManifestItemLoaderInterface} deps.actionLoader - Action loader.
 * @param {BaseManifestItemLoaderInterface} deps.ruleLoader - Rule loader.
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
    entityDefinitions: entityDefinitionLoader,
    entityInstances: entityInstanceLoader,
  });
}

export default createDefaultContentLoadersConfig;
