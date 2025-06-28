// src/loaders/loaderMeta.js

/**
 * @file Contains metadata describing each supported content loader type.
 * New loaders should be added here so configuration logic stays centralized.
 */

/**
 * Mapping of registry keys to loader metadata used by
 * {@link createContentLoadersConfig}.
 *
 * @type {Record<string, {contentKey:string, diskFolder:string, phase:'definitions'|'instances', registryKey:string}>}
 */
export const meta = {
  components: {
    contentKey: 'components',
    diskFolder: 'components',
    phase: 'definitions',
    registryKey: 'components',
  },
  events: {
    contentKey: 'events',
    diskFolder: 'events',
    phase: 'definitions',
    registryKey: 'events',
  },
  conditions: {
    contentKey: 'conditions',
    diskFolder: 'conditions',
    phase: 'definitions',
    registryKey: 'conditions',
  },
  macros: {
    contentKey: 'macros',
    diskFolder: 'macros',
    phase: 'definitions',
    registryKey: 'macros',
  },
  actions: {
    contentKey: 'actions',
    diskFolder: 'actions',
    phase: 'definitions',
    registryKey: 'actions',
  },
  rules: {
    contentKey: 'rules',
    diskFolder: 'rules',
    phase: 'definitions',
    registryKey: 'rules',
  },
  goals: {
    contentKey: 'goals',
    diskFolder: 'goals',
    phase: 'definitions',
    registryKey: 'goals',
  },
  scopes: {
    contentKey: 'scopes',
    diskFolder: 'scopes',
    phase: 'definitions',
    registryKey: 'scopes',
  },
  entityDefinitions: {
    contentKey: 'entities.definitions',
    diskFolder: 'entities/definitions',
    phase: 'definitions',
    registryKey: 'entityDefinitions',
  },
  entityInstances: {
    contentKey: 'entities.instances',
    diskFolder: 'entities/instances',
    phase: 'instances',
    registryKey: 'entityInstances',
  },
  anatomyRecipes: {
    contentKey: 'anatomy.recipes',
    diskFolder: 'anatomy/recipes',
    phase: 'definitions',
    registryKey: 'anatomyRecipes',
  },
  anatomyBlueprints: {
    contentKey: 'anatomy.blueprints',
    diskFolder: 'anatomy/blueprints',
    phase: 'definitions',
    registryKey: 'anatomyBlueprints',
  },
  anatomyParts: {
    contentKey: 'anatomy.parts',
    diskFolder: 'anatomy/parts',
    phase: 'definitions',
    registryKey: 'anatomyParts',
  },
};

export default meta;
