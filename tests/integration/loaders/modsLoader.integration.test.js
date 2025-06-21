import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CORE_MOD_ID } from '../../../src/constants/core.js';
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';
import { setupManifests } from '../../common/loaders/modsLoader.test-utils.js';

/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').TestEnvironment} TestEnvironment */

describe('ModsLoader Integration Test Suite (TEST-LOADER-7.1)', () => {
  /** @type {TestEnvironment} */
  let env;
  /** @type {jest.SpyInstance} */
  let processManifestsSpy;
  /** @type {jest.SpyInstance} */
  let loadContentSpy;

  /** @type {Map<string, object>} */
  let manifestMap;
  const worldName = 'testWorldSimple';

  beforeEach(() => {
    env = createTestEnvironment();

    const coreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core Game Systems',
      gameVersion: '^1.0.0',
      content: {
        actions: ['core/action_move.json', 'core/action_look.json'],
        components: ['core/comp_position.json'],
        entityDefinitions: ['characters/core/entity_player_base.json'],
        macros: ['core/logSuccess.macro.json'],
      },
    };

    manifestMap = new Map([[CORE_MOD_ID.toLowerCase(), coreManifest]]);
    setupManifests(env, manifestMap, [CORE_MOD_ID]);

    processManifestsSpy = jest
      .spyOn(env.modsLoader._modManifestProcessor, 'processManifests')
      .mockResolvedValue({
        loadedManifestsMap: manifestMap,
        finalOrder: [CORE_MOD_ID],
        incompatibilityCount: 0,
      });

    loadContentSpy = jest
      .spyOn(env.modsLoader._contentLoadManager, 'loadContent')
      .mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully load world with only the core mod', async () => {
    await expect(env.modsLoader.loadWorld(worldName)).resolves.not.toThrow();

    expect(env.mockRegistry.clear).toHaveBeenCalledTimes(1);
    expect(env.mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(
      1
    );

    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:game'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:components'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:mod-manifest'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:entityDefinitions'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:actions'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:events'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:rules'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:conditions'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:entityInstances'
    );
    expect(env.mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:goals'
    );

    expect(env.mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
    expect(processManifestsSpy).toHaveBeenCalledTimes(1);
    expect(processManifestsSpy).toHaveBeenCalledWith([CORE_MOD_ID], worldName);

    expect(loadContentSpy).toHaveBeenCalledTimes(1);
    expect(loadContentSpy).toHaveBeenCalledWith(
      [CORE_MOD_ID],
      manifestMap,
      expect.any(Object)
    );

    expect(env.mockWorldLoader.loadWorlds).toHaveBeenCalledTimes(1);
    expect(env.mockWorldLoader.loadWorlds).toHaveBeenCalledWith(
      [CORE_MOD_ID],
      manifestMap,
      expect.any(Object)
    );

    expect(env.mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:failed',
      expect.anything(),
      expect.anything()
    );
    expect(env.mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:mod_load_failed',
      expect.anything(),
      expect.anything()
    );
    expect(env.mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.anything(),
      expect.anything()
    );
  });
});
