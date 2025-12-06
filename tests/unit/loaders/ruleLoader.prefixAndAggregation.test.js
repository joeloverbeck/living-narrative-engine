import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as macroUtils from '../../../src/utils/macroUtils.js';
import RuleLoader from '../../../src/loaders/ruleLoader.js';

const createMockDeps = () => {
  const config = {
    getModsBasePath: jest.fn().mockReturnValue('./mods'),
    getContentTypeSchemaId: jest
      .fn()
      .mockReturnValue('schema://living-narrative-engine/rule.schema.json'),
  };
  const resolver = { resolveModContentPath: jest.fn() };
  const fetcher = { fetch: jest.fn() };
  const validator = {
    validate: jest.fn(),
    getValidator: jest.fn(),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
  };
  const registry = {
    store: jest.fn(),
    get: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  return { config, resolver, fetcher, validator, registry, logger };
};

describe('RuleLoader additional coverage', () => {
  /** @type {ReturnType<typeof createMockDeps>} */
  let deps;
  /** @type {RuleLoader} */
  let loader;

  beforeEach(() => {
    deps = createMockDeps();
    loader = new RuleLoader(
      deps.config,
      deps.resolver,
      deps.fetcher,
      deps.validator,
      deps.registry,
      deps.logger
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('strips prefixed rule identifiers before storing them', async () => {
    const storeSpy = jest
      .spyOn(loader, '_storeItemInRegistry')
      .mockReturnValue({ qualifiedId: 'core:customRule', didOverride: false });

    const data = { rule_id: 'core:customRule' };

    const result = await loader._processFetchedItem(
      'core',
      'custom.rule.json',
      '/tmp/custom.rule.json',
      data,
      'rules'
    );

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "RuleLoader [core]: rule_id 'core:customRule' in custom.rule.json already prefixed. Stripping prefix."
    );
    expect(storeSpy).toHaveBeenCalledWith(
      'rules',
      'core',
      'customRule',
      expect.any(Object),
      'custom.rule.json'
    );
    expect(result).toEqual({
      qualifiedId: 'core:customRule',
      didOverride: false,
    });
  });

  it('throws when macro expansion validation reports incomplete expansion', async () => {
    const expandedActions = [{ type: 'LOG', parameters: { message: 'hello' } }];
    jest
      .spyOn(macroUtils, 'expandMacros')
      .mockImplementation(() => expandedActions);
    jest.spyOn(macroUtils, 'validateMacroExpansion').mockReturnValue(false);

    const data = {
      rule_id: 'test',
      actions: [{ macro: 'core:hello' }],
    };

    await expect(
      loader._processFetchedItem(
        'core',
        'macro.rule.json',
        '/tmp/macro.rule.json',
        data,
        'rules'
      )
    ).rejects.toThrow('Failed to expand all macros in macro.rule.json');

    expect(macroUtils.expandMacros).toHaveBeenCalledWith(
      expect.any(Array),
      deps.registry,
      deps.logger
    );
    expect(macroUtils.validateMacroExpansion).toHaveBeenCalledWith(
      expandedActions,
      deps.registry,
      deps.logger
    );
  });

  it('aggregates counts and continues after load errors in loadAllRules', async () => {
    const loadItemsForMod = jest
      .spyOn(loader, 'loadItemsForMod')
      .mockResolvedValueOnce({ count: 2, overrides: 0, errors: 0 })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ count: 5, overrides: 1, errors: 0 });

    const modsToLoad = [
      { modId: 'core', manifest: { content: { rules: ['a.rule.json'] } } },
      { modId: 'story', manifest: { content: { rules: ['b.rule.json'] } } },
      { modId: 'bonus', manifest: { content: { rules: ['c.rule.json'] } } },
    ];

    const total = await loader.loadAllRules(modsToLoad);

    expect(total).toBe(7);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'RuleLoader: loadAllRules is potentially deprecated. Aggregation should use results from loadItemsForMod.'
    );
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'RuleLoader: Starting rule loading for 3 mods.'
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      "RuleLoader: Unexpected error during rule loading orchestration for mod 'story'. Error: boom",
      expect.objectContaining({ modId: 'story' })
    );
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'RuleLoader: Finished loading rules for all mods. Total rules count: 7.'
    );
    expect(loadItemsForMod).toHaveBeenNthCalledWith(
      1,
      'core',
      modsToLoad[0].manifest,
      'rules',
      'rules',
      'rules'
    );
    expect(loadItemsForMod).toHaveBeenNthCalledWith(
      2,
      'story',
      modsToLoad[1].manifest,
      'rules',
      'rules',
      'rules'
    );
    expect(loadItemsForMod).toHaveBeenNthCalledWith(
      3,
      'bonus',
      modsToLoad[2].manifest,
      'rules',
      'rules',
      'rules'
    );
  });
});
