/**
 * @file Unit tests for ModValidationOrchestrator
 * @description Provides thorough coverage for modValidationOrchestrator.js including
 * dependency handling, cross-reference flows, and specialized error cases.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import path from 'path';
import fs from 'fs';

import {
  ModValidationOrchestrator,
  ModValidationError,
} from '../../../cli/validation/modValidationOrchestrator.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    access: jest.fn(),
  },
}));

const mockedFs = fs.promises;

const createDependencies = () => {
  const logger = createMockLogger();
  const modDependencyValidator = {
    validate: jest.fn(),
  };
  const modCrossReferenceValidator = {
    validateModReferences: jest.fn(),
    validateAllModReferences: jest.fn(),
  };
  const modLoadOrderResolver = {
    resolve: jest.fn((ids) => [...ids]),
  };
  const modManifestLoader = {
    loadRequestedManifests: jest.fn(
      async (ids) => new Map(ids.map((id) => [id, { id, dependencies: [] }]))
    ),
    loadModManifests: jest.fn(),
  };
  const pathResolver = {
    resolveModManifestPath: jest.fn(),
    resolveModPath: jest.fn((id) => `/mods/${id}`),
  };
  const configuration = {
    getContentTypeSchemaId: jest.fn(),
  };

  const fileExistenceValidator = {
    validateAllMods: jest.fn(async () => new Map()),
    validateAllModsUnregistered: jest.fn(async () => new Map()),
  };

  return {
    logger,
    modDependencyValidator,
    modCrossReferenceValidator,
    modLoadOrderResolver,
    modManifestLoader,
    pathResolver,
    configuration,
    fileExistenceValidator,
  };
};

const createOrchestrator = (overrides = {}) => {
  const base = createDependencies();
  const deps = {
    ...base,
    ...overrides,
  };
  const orchestrator = new ModValidationOrchestrator(deps);
  return { orchestrator, deps };
};

describe('ModValidationError', () => {
  it('aggregates dependency and cross-reference failures into the error message', () => {
    const crossRefResults = new Map([
      [
        'modA',
        {
          violations: [{}, {}],
          hasViolations: true,
        },
      ],
      [
        'modB',
        {
          violations: [],
          hasViolations: false,
        },
      ],
    ]);

    const validationResults = {
      dependencies: { isValid: false, errors: ['missing dependency'] },
      crossReferences: crossRefResults,
    };

    const error = new ModValidationError(validationResults);

    expect(error.message).toContain('Dependency validation failed: 1 errors');
    expect(error.message).toContain(
      'Cross-reference validation failed: 2 violations'
    );
    expect(error.validationResults).toBe(validationResults);
  });

  it('supports plain cross-reference result objects', () => {
    const error = new ModValidationError({
      dependencies: { isValid: true },
      crossReferences: { violations: [1, 2, 3] },
    });

    expect(error.message).toContain(
      'Cross-reference validation failed: 3 violations'
    );
    expect(error.name).toBe('ModValidationError');
  });
});

describe('ModValidationOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.readdir.mockResolvedValue([]);
    mockedFs.access.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createManifestsMap = (ids) =>
    new Map(ids.map((id) => [id, { id, dependencies: [] }]));

  it('validates the ecosystem successfully when all phases pass', async () => {
    const { orchestrator, deps } = createOrchestrator();

    const manifests = createManifestsMap(['alpha', 'beta']);
    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(manifests);
    deps.modCrossReferenceValidator.validateAllModReferences.mockResolvedValue(
      new Map([
        [
          'alpha',
          {
            hasViolations: false,
            violations: [],
          },
        ],
        [
          'beta',
          {
            hasViolations: false,
            violations: [],
          },
        ],
      ])
    );

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha', 'beta'],
    });

    expect(deps.modManifestLoader.loadRequestedManifests).toHaveBeenCalledWith([
      'alpha',
      'beta',
    ]);
    expect(deps.modDependencyValidator.validate).toHaveBeenCalledTimes(1);
    expect(result.isValid).toBe(true);
    expect(result.dependencies.isValid).toBe(true);
    expect(result.crossReferences).toBeInstanceOf(Map);
    expect(result.loadOrder.order).toEqual(['alpha', 'beta']);
    expect(result.warnings).toHaveLength(0);
    expect(result.performance.phases.has('manifest-loading')).toBe(true);
    expect(result.performance.phases.has('dependency-validation')).toBe(true);
    expect(result.performance.phases.has('load-order-resolution')).toBe(true);
    expect(result.performance.phases.has('cross-reference-validation')).toBe(
      true
    );
  });

  it('captures dependency validation failures without failFast', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw new ModDependencyError('dependency failed');
    });

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
    });

    expect(result.dependencies.isValid).toBe(false);
    expect(result.errors).toContain('Dependency validation failed');
    expect(result.crossReferences).toBeNull();
    expect(
      deps.modCrossReferenceValidator.validateAllModReferences
    ).not.toHaveBeenCalled();
    expect(result.isValid).toBe(false);
  });

  it('throws ModValidationError when dependency validation fails with failFast', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw new ModDependencyError('dependency failed');
    });

    await expect(
      orchestrator.validateEcosystem({
        modsToValidate: ['alpha'],
        failFast: true,
      })
    ).rejects.toBeInstanceOf(ModValidationError);
  });

  it('adds warnings when cross-reference validation finds violations', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modCrossReferenceValidator.validateAllModReferences.mockResolvedValue(
      new Map([
        [
          'alpha',
          {
            hasViolations: true,
            violations: [{ severity: 'warning' }],
          },
        ],
      ])
    );

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
    });

    expect(result.warnings).toContain(
      'Cross-reference validation found 1 violations'
    );
    expect(result.isValid).toBe(false);
  });

  it('captures failFast ModValidationError generated during cross-reference validation', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modCrossReferenceValidator.validateAllModReferences.mockResolvedValue(
      new Map([
        [
          'alpha',
          {
            hasViolations: true,
            violations: [{ severity: 'critical' }],
          },
        ],
      ])
    );

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
      failFast: true,
    });

    const errorLog = deps.logger.error.mock.calls.find(
      ([message]) => message === 'Cross-reference validation failed'
    );
    expect(errorLog?.[1]).toBeInstanceOf(ModValidationError);
    expect(
      result.errors.some((msg) =>
        msg.includes(
          'Cross-reference validation failed: Mod ecosystem validation failed'
        )
      )
    ).toBe(true);
  });

  it('collects errors when cross-reference validation throws', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modCrossReferenceValidator.validateAllModReferences.mockRejectedValue(
      new Error('cross reference explosion')
    );

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
    });

    expect(result.errors).toContain(
      'Cross-reference validation failed: cross reference explosion'
    );
    expect(result.isValid).toBe(false);
  });

  it('skips cross-reference validation when requested', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );

    await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
      skipCrossReferences: true,
    });

    expect(
      deps.modCrossReferenceValidator.validateAllModReferences
    ).not.toHaveBeenCalled();
  });

  it('records warnings when load order resolution fails', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modLoadOrderResolver.resolve.mockImplementation(() => {
      throw new Error('load order failure');
    });

    const result = await orchestrator.validateEcosystem({
      modsToValidate: ['alpha'],
    });

    expect(result.warnings).toContain(
      'Load order resolution failed: load order failure'
    );
    expect(result.loadOrder).toBeNull();
  });

  it('rethrows unexpected errors from dependency validation', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw new Error('unexpected failure');
    });

    await expect(
      orchestrator.validateEcosystem({ modsToValidate: ['alpha'] })
    ).rejects.toThrow('unexpected failure');
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Ecosystem validation failed',
      expect.any(Error)
    );
  });

  it('wraps manifest loading failures as ModDependencyError', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockRejectedValue(
      new Error('cannot load manifests')
    );

    await expect(
      orchestrator.validateEcosystem({ modsToValidate: ['alpha'] })
    ).rejects.toBeInstanceOf(ModDependencyError);
  });

  it('discovers mod ids when none are supplied', async () => {
    const dirEntries = [
      { name: 'alpha', isDirectory: () => true },
      { name: 'examples', isDirectory: () => true },
      { name: 'beta', isDirectory: () => true },
      { name: 'readme.md', isDirectory: () => false },
    ];

    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockImplementation(async (targetPath) => {
      if (targetPath.includes('alpha') || targetPath.includes('beta')) {
        return undefined;
      }
      throw new Error('missing manifest');
    });

    const { orchestrator, deps } = createOrchestrator();
    deps.modManifestLoader.loadRequestedManifests.mockImplementation(
      async (ids) => {
        expect(ids).toEqual(['alpha', 'beta']);
        return createManifestsMap(ids);
      }
    );

    deps.modCrossReferenceValidator.validateAllModReferences.mockResolvedValue(
      new Map()
    );

    const result = await orchestrator.validateEcosystem();
    expect(result.isValid).toBe(true);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'Skipping excluded directory: examples'
    );
  });

  it('propagates discovery errors from the filesystem', async () => {
    mockedFs.readdir.mockRejectedValue(new Error('filesystem offline'));
    const { orchestrator } = createOrchestrator();

    await expect(orchestrator.validateEcosystem()).rejects.toThrow(
      'Failed to load mod manifests: Failed to discover mods: filesystem offline'
    );
  });

  it('validates individual mods successfully', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([
        [
          'alpha',
          {
            id: 'alpha',
            dependencies: [],
          },
        ],
      ])
    );
    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue({
      hasViolations: false,
      violations: [],
    });

    const result = await orchestrator.validateMod('alpha');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      deps.modCrossReferenceValidator.validateModReferences
    ).toHaveBeenCalledWith('/mods/alpha', expect.any(Map));
  });

  it('throws when attempting to validate an unknown mod', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();
    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(new Map());

    await expect(orchestrator.validateMod('missing')).rejects.toThrow(
      "Mod 'missing' not found in ecosystem"
    );
  });

  it('stops early when dependency validation fails and context is excluded', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw new Error('dependency failure');
    });

    const result = await orchestrator.validateMod('alpha', {
      includeContext: false,
    });

    expect(result.dependencies.isValid).toBe(false);
    expect(result.crossReferences).toBeNull();
    expect(result.errors).toContain('Dependency validation failed');
    expect(
      deps.modCrossReferenceValidator.validateModReferences
    ).not.toHaveBeenCalled();
  });

  it('adds warnings when mod cross-reference validation reports issues', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue({
      hasViolations: true,
      violations: [{ id: 'issue' }],
    });

    const result = await orchestrator.validateMod('alpha');
    expect(result.warnings).toContain('1 cross-reference violations');
    expect(result.isValid).toBe(false);
  });

  it('records errors when mod cross-reference validation fails', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    deps.modCrossReferenceValidator.validateModReferences.mockRejectedValue(
      new Error('explosion')
    );

    const result = await orchestrator.validateMod('alpha');
    expect(result.errors).toContain(
      'Cross-reference validation failed: explosion'
    );
    expect(result.isValid).toBe(false);
  });

  it('injects declared dependencies when validating an individual mod', async () => {
    const dirEntries = [
      { name: 'alpha', isDirectory: () => true },
      { name: 'beta', isDirectory: () => true },
      { name: 'gamma', isDirectory: () => true },
    ];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    const manifests = new Map([
      ['alpha', { id: 'alpha', dependencies: ['beta', { id: 'gamma' }] }],
      ['beta', { id: 'beta', dependencies: [] }],
      ['gamma', { id: 'gamma', dependencies: [] }],
    ]);

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(manifests);
    deps.modDependencyValidator.validate.mockImplementation((map) => {
      expect(Array.from(map.keys())).toEqual(
        expect.arrayContaining(['alpha', 'beta', 'gamma'])
      );
    });
    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue({
      hasViolations: false,
      violations: [],
    });

    await orchestrator.validateMod('alpha');
  });

  it('handles dependency validation errors with complex dependency manifests', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    const errorWithThrowingGetter = {
      get message() {
        throw new Error('dependency getter failure');
      },
    };

    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw errorWithThrowingGetter;
    });

    const result = await orchestrator.validateMod('alpha');
    expect(result.dependencies.errors).toEqual(['dependency getter failure']);
    expect(result.errors).toContain('Dependency validation failed');
  });

  it('respects the skipCrossReferences flag during mod validation', async () => {
    const dirEntries = [{ name: 'alpha', isDirectory: () => true }];
    mockedFs.readdir.mockResolvedValue(dirEntries);
    mockedFs.access.mockResolvedValue();

    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    await orchestrator.validateMod('alpha', { skipCrossReferences: true });
    expect(
      deps.modCrossReferenceValidator.validateModReferences
    ).not.toHaveBeenCalled();
  });

  it('validates mods for loading and accumulates warnings', async () => {
    const { orchestrator, deps } = createOrchestrator();

    const modIds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map(modIds.map((id) => [id, { id, dependencies: [] }]))
    );

    const violationReport = {
      hasViolations: true,
      violations: Array.from({ length: 6 }, (_, index) => ({
        id: `warn-${index}`,
        severity: 'warning',
      })),
    };

    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue(
      violationReport
    );

    const result = await orchestrator.validateForLoading(modIds);

    expect(result.canLoad).toBe(true);
    expect(result.warnings).toHaveLength(modIds.length);
    expect(result.recommendations).toContain(
      'Review cross-reference warnings for potential runtime issues'
    );
    expect(result.recommendations).toContain(
      'Consider running full ecosystem validation to address systemic issues'
    );
  });

  it('throws when dependency validation fails in strict mode for loading', async () => {
    const { orchestrator, deps } = createOrchestrator();
    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      createManifestsMap(['alpha'])
    );
    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw new ModDependencyError('dependency failure');
    });

    await expect(
      orchestrator.validateForLoading(['alpha'], { strictMode: true })
    ).rejects.toBeInstanceOf(ModValidationError);
  });

  it('surfaces critical cross-reference issues in strict mode via warnings', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue({
      hasViolations: true,
      violations: [{ severity: 'critical' }],
    });

    const result = await orchestrator.validateForLoading(['alpha'], {
      strictMode: true,
    });

    expect(
      result.warnings.some((msg) =>
        msg.includes('validation failed - Mod ecosystem validation failed')
      )
    ).toBe(true);
    const warnLog = deps.logger.warn.mock.calls.find(([message]) =>
      message.includes('Cross-reference validation failed for alpha')
    );
    expect(warnLog?.[1]).toBeInstanceOf(ModValidationError);
  });

  it('collects warnings when cross-reference validation fails during loading', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    deps.modCrossReferenceValidator.validateModReferences.mockRejectedValue(
      new Error('network error')
    );

    const result = await orchestrator.validateForLoading(['alpha']);

    expect(result.warnings).toEqual([
      'alpha: validation failed - network error',
    ]);
    expect(result.recommendations).toContain(
      'Review cross-reference warnings for potential runtime issues'
    );
  });

  it('captures unexpected errors from loading dependency validation without strict mode', async () => {
    const { orchestrator, deps } = createOrchestrator();

    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['alpha', { id: 'alpha', dependencies: [] }]])
    );

    const errorWithThrowingGetter = {
      get message() {
        throw new Error('load dependency failure');
      },
    };

    deps.modDependencyValidator.validate.mockImplementation(() => {
      throw errorWithThrowingGetter;
    });

    deps.modCrossReferenceValidator.validateModReferences.mockResolvedValue({
      hasViolations: false,
      violations: [],
    });

    const result = await orchestrator.validateForLoading(['alpha']);
    expect(result.dependencies.errors).toEqual(['load dependency failure']);
    expect(result.recommendations).toContain(
      'Resolve dependency issues before loading'
    );
    const errorLog = deps.logger.error.mock.calls.find(
      ([message]) => message === 'Loading dependency validation failed'
    );
    expect(errorLog?.[1]).toBeInstanceOf(Error);
  });

  it('falls back to default mod path resolution when pathResolver lacks resolveModPath', () => {
    const baseDeps = createDependencies();
    const alternatePathResolver = {
      resolveModManifestPath: jest.fn(),
    };

    const orchestrator = new ModValidationOrchestrator({
      ...baseDeps,
      pathResolver: alternatePathResolver,
    });

    jest.spyOn(process, 'cwd').mockReturnValue('/workspace');

    const resolvedPath = orchestrator._resolveModPath('alpha', {});
    expect(resolvedPath).toBe(path.join('/workspace', 'data', 'mods', 'alpha'));
  });
});
