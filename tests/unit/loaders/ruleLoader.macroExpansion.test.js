import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import RuleLoader from '../../../src/loaders/ruleLoader.js';
import { MacroExpansionError } from '../../../src/utils/macroUtils.js';

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
    get: jest.fn((type, id) => {
      if (type === 'macros') {
        return macros[id];
      }
      return undefined;
    }),
  };
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  return { config, resolver, fetcher, validator, registry, logger };
};

let macros;
let deps;
let loader;

beforeEach(() => {
  macros = {
    'core:hello': { actions: [{ type: 'LOG', parameters: { msg: 'hi' } }] },
  };
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

describe('RuleLoader macro expansion', () => {
  it('expands macros before storing rule', async () => {
    const data = {
      rule_id: 'test',
      event_type: 'some:event',
      actions: [{ macro: 'core:hello' }],
    };
    jest.spyOn(loader, '_storeItemInRegistry').mockReturnValue(false);
    await loader._processFetchedItem(
      'core',
      'file.rule.json',
      '/tmp/file.rule.json',
      data,
      'rules'
    );
    expect(loader._storeItemInRegistry).toHaveBeenCalledWith(
      'rules',
      'core',
      'test',
      expect.objectContaining({
        actions: [{ type: 'LOG', parameters: { msg: 'hi' } }],
      }),
      'file.rule.json'
    );
  });

  it('throws MacroExpansionError when referenced macro is not found', async () => {
    const data = {
      rule_id: 'test',
      event_type: 'some:event',
      actions: [{ macro: 'core:nonexistent' }],
    };

    await expect(
      loader._processFetchedItem(
        'core',
        'file.rule.json',
        '/tmp/file.rule.json',
        data,
        'rules'
      )
    ).rejects.toThrow(MacroExpansionError);
  });

  it('includes macro ID in error message when macro not found', async () => {
    const data = {
      rule_id: 'test',
      event_type: 'some:event',
      actions: [{ macro: 'core:missingMacro' }],
    };

    await expect(
      loader._processFetchedItem(
        'core',
        'file.rule.json',
        '/tmp/file.rule.json',
        data,
        'rules'
      )
    ).rejects.toThrow("macro 'core:missingMacro' not found");
  });

  it('logs error when macro expansion fails', async () => {
    const data = {
      rule_id: 'test',
      event_type: 'some:event',
      actions: [{ macro: 'core:missingMacro' }],
    };

    await expect(
      loader._processFetchedItem(
        'core',
        'file.rule.json',
        '/tmp/file.rule.json',
        data,
        'rules'
      )
    ).rejects.toThrow();

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("macro 'core:missingMacro' not found"),
      expect.any(Object)
    );
  });
});
