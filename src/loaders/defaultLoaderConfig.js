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
 * Creates the default loader configuration used by WorldLoader when a custom
 * configuration isn't supplied.
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
  return [
    {
      loader: componentDefinitionLoader,
      contentKey: 'components',
      contentTypeDir: 'components',
      typeName: 'components',
    },
    {
      loader: eventLoader,
      contentKey: 'events',
      contentTypeDir: 'events',
      typeName: 'events',
    },
    {
      loader: conditionLoader,
      contentKey: 'conditions',
      contentTypeDir: 'conditions',
      typeName: 'conditions',
    },
    {
      loader: macroLoader,
      contentKey: 'macros',
      contentTypeDir: 'macros',
      typeName: 'macros',
    },
    {
      loader: actionLoader,
      contentKey: 'actions',
      contentTypeDir: 'actions',
      typeName: 'actions',
    },
    {
      loader: ruleLoader,
      contentKey: 'rules',
      contentTypeDir: 'rules',
      typeName: 'rules',
    },
    {
      loader: entityDefinitionLoader,
      contentKey: 'entityDefinitions',
      contentTypeDir: 'entities/definitions',
      typeName: 'entityDefinitions',
    },
    {
      loader: entityInstanceLoader,
      contentKey: 'entityInstances',
      contentTypeDir: 'entities/instances',
      typeName: 'entityInstances',
    },
  ];
}

export default createDefaultContentLoadersConfig;
