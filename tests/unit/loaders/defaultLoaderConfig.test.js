import {
  createContentLoadersConfig,
  createDefaultContentLoadersConfig,
} from '../../../src/loaders/defaultLoaderConfig.js';

describe('defaultLoaderConfig', () => {
  it('createContentLoadersConfig returns correct structure', () => {
    const stubLoader = {};
    const loaderMap = {
      components: stubLoader,
      events: stubLoader,
      conditions: stubLoader,
      macros: stubLoader,
      actions: stubLoader,
      rules: stubLoader,
      goals: stubLoader,
      scopes: stubLoader,
      entityDefinitions: stubLoader,
      entityInstances: stubLoader,
      anatomyRecipes: stubLoader,
      anatomyBlueprints: stubLoader,
    };
    const config = createContentLoadersConfig(loaderMap);
    expect(config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'components',
          contentKey: 'components',
          diskFolder: 'components',
          phase: 'definitions',
        }),
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'entityInstances',
          contentKey: 'entities.instances',
          diskFolder: 'entities/instances',
          phase: 'instances',
        }),
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'anatomyRecipes',
          contentKey: 'recipes',
          diskFolder: 'anatomy/recipes',
          phase: 'definitions',
        }),
      ])
    );
    expect(config).toHaveLength(Object.keys(loaderMap).length);
  });

  it('createContentLoadersConfig handles minimal loader map', () => {
    const stubLoader = {};
    const loaderMap = { components: stubLoader };
    const config = createContentLoadersConfig(loaderMap);
    expect(config).toEqual([
      {
        loader: stubLoader,
        registryKey: 'components',
        contentKey: 'components',
        diskFolder: 'components',
        phase: 'definitions',
      },
    ]);
  });

  it('createDefaultContentLoadersConfig returns correct array and calls createContentLoadersConfig', () => {
    const stubLoader = {};
    const deps = {
      componentLoader: stubLoader,
      eventLoader: stubLoader,
      conditionLoader: stubLoader,
      macroLoader: stubLoader,
      actionLoader: stubLoader,
      ruleLoader: stubLoader,
      goalLoader: stubLoader,
      scopeLoader: stubLoader,
      entityDefinitionLoader: stubLoader,
      entityInstanceLoader: stubLoader,
      anatomyRecipeLoader: stubLoader,
      anatomyBlueprintLoader: stubLoader,
    };
    const config = createDefaultContentLoadersConfig(deps);
    expect(config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'components',
        }),
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'entityInstances',
        }),
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'anatomyRecipes',
        }),
        expect.objectContaining({
          loader: stubLoader,
          registryKey: 'anatomyBlueprints',
        }),
      ])
    );
    expect(config).toHaveLength(Object.keys(deps).length);
  });
});
