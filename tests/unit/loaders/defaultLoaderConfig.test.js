import { createContentLoadersConfig, createDefaultContentLoadersConfig } from '../../../src/loaders/defaultLoaderConfig.js';

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
      entityDefinitions: stubLoader,
      entityInstances: stubLoader,
    };
    const config = createContentLoadersConfig(loaderMap);
    expect(config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loader: stubLoader, registryKey: 'components', contentKey: 'components', diskFolder: 'components', phase: 'definitions' }),
        expect.objectContaining({ loader: stubLoader, registryKey: 'entityInstances', contentKey: 'entityInstances', diskFolder: 'entities/instances', phase: 'instances' }),
      ])
    );
    expect(config).toHaveLength(Object.keys(loaderMap).length);
  });

  it('createDefaultContentLoadersConfig returns correct array and calls createContentLoadersConfig', () => {
    const stubLoader = {};
    const deps = {
      componentDefinitionLoader: stubLoader,
      eventLoader: stubLoader,
      conditionLoader: stubLoader,
      macroLoader: stubLoader,
      actionLoader: stubLoader,
      ruleLoader: stubLoader,
      goalLoader: stubLoader,
      entityDefinitionLoader: stubLoader,
      entityInstanceLoader: stubLoader,
    };
    const config = createDefaultContentLoadersConfig(deps);
    expect(config).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loader: stubLoader, registryKey: 'components' }),
        expect.objectContaining({ loader: stubLoader, registryKey: 'entityInstances' }),
      ])
    );
    expect(config).toHaveLength(Object.keys(deps).length);
  });
}); 