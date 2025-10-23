import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';
import { createEnhancedMockLogger } from '../../common/mockFactories/loggerMocks.js';

const createManifestMap = (manifests) =>
  new Map(manifests.map((manifest) => [manifest.id.toLowerCase(), manifest]));

describe('ModLoadOrderResolver integration – graph utils deep coverage', () => {
  let logger;
  let resolver;

  beforeEach(() => {
    logger = createEnhancedMockLogger();
    resolver = new ModLoadOrderResolver(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves complex dependency graphs with stable ordering and optional deps', () => {
    const requestedIds = [
      'AlphaNode',
      'BetaNode',
      'GammaModule',
      'DeltaModule',
      'ExtraMod',
    ];

    const manifests = createManifestMap([
      {
        id: 'AlphaNode',
        dependencies: [
          { id: 'BetaNode', required: true },
          { id: 'GammaModule', required: false },
          { id: 'OptionalHelper', required: false },
        ],
      },
      {
        id: 'BetaNode',
        dependencies: [{ id: 'GammaModule', required: true }],
      },
      { id: 'GammaModule' },
      { id: 'DeltaModule' },
      { id: 'ExtraMod' },
      { id: 'OptionalHelper' },
      { id: 'CORE' },
    ]);

    const order = resolver.resolve(requestedIds, manifests);

    expect(order).toEqual([
      CORE_MOD_ID,
      'GammaModule',
      'BetaNode',
      'AlphaNode',
      'DeltaModule',
      'ExtraMod',
    ]);

    expect(order).not.toContain('OptionalHelper');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Mod load order adjusted to satisfy dependencies.')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('modLoadOrderResolver: Resolved load order')
    );
  });

  it('surfaces missing dependency errors from graph construction', () => {
    const manifests = createManifestMap([
      {
        id: 'StoryMod',
        dependencies: [{ id: 'LoreMod', required: true }],
      },
    ]);

    expect(() => resolver.resolve(['StoryMod'], manifests)).toThrow(
      ModDependencyError
    );
    expect(() => resolver.resolve(['StoryMod'], manifests)).toThrow(
      "MISSING_DEPENDENCY: Mod 'StoryMod' requires mod 'LoreMod', but the manifest for 'LoreMod' was not found."
    );
  });

  it('maintains defensive guards when manifests map is malformed', () => {
    expect(() => resolver.resolve(['ModA'], null)).toThrow(
      'ModLoadOrderResolver.resolve: `manifestsMap`'
    );
    expect(() => resolver.resolve(['ModA'], { id: 'not-a-map' })).toThrow(
      'ModLoadOrderResolver.resolve: `manifestsMap`'
    );
  });
});
