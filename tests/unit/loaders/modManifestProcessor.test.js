// tests/unit/loaders/modManifestProcessor.test.js

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';

class DummyManifestLoader {
  constructor(map) {
    this.map = map;
    this.loadRequestedManifests = jest.fn(async () => this.map);
  }
}

describe('ModManifestProcessor.processManifests', () => {
  /** @type {DummyManifestLoader} */
  let manifestLoader;
  /** @type {jest.Mocked<any>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let registry;
  /** @type {jest.Mocked<any>} */
  let dispatcher;
  /** @type {jest.Mocked<any>} */
  let modDependencyValidator;
  /** @type {jest.Mock} */
  let modVersionValidator;
  /** @type {jest.Mocked<any>} */
  let modLoadOrderResolver;
  /** @type {ModManifestProcessor} */
  let processor;
  /** @type {Map<string, any>} */
  let manifestMap;
  const worldName = 'test-world'; // Define a world name for the tests

  beforeEach(() => {
    manifestMap = new Map([
      ['modA', { id: 'modA', version: '1.0.0' }],
      ['modB', { id: 'modB', version: '1.0.0' }],
    ]);
    manifestLoader = new DummyManifestLoader(manifestMap);
    logger = { debug: jest.fn(), warn: jest.fn() };
    registry = { store: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    modDependencyValidator = { validate: jest.fn() };
    modVersionValidator = jest.fn();
    modLoadOrderResolver = { resolve: jest.fn(() => ['modA', 'modB']) };
    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });
  });

  it('processes manifests successfully', async () => {
    const requestedIds = ['modA', 'modB'];
    const result = await processor.processManifests(requestedIds, worldName);

    expect(manifestLoader.loadRequestedManifests).toHaveBeenCalledWith(
      requestedIds,
      worldName
    );
    expect(modDependencyValidator.validate).toHaveBeenCalledWith(
      expect.any(Map),
      logger
    );
    expect(modVersionValidator).toHaveBeenCalledWith(
      expect.any(Map),
      logger,
      dispatcher
    );
    expect(modLoadOrderResolver.resolve).toHaveBeenCalledWith(
      ['modA', 'modB'],
      expect.any(Map)
    );
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'moda',
      manifestMap.get('modA')
    );
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'modb',
      manifestMap.get('modB')
    );
    expect(registry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [
      'modA',
      'modB',
    ]);
    expect(result.finalModOrder).toEqual(['modA', 'modB']);
    expect(result.loadedManifestsMap.size).toBe(2);
    expect(result.incompatibilityCount).toBe(0);
  });

  it('throws and logs when version validation fails', async () => {
    const error = new ModDependencyError(
      'modA incompatible\nmodB incompatible'
    );
    modVersionValidator.mockImplementation(() => {
      throw error;
    });

    await expect(
      processor.processManifests(['modA', 'modB'], worldName)
    ).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Encountered 1 engine version incompatibilities'),
      error
    );
    // In the new implementation, version validation happens before order resolution
    expect(modLoadOrderResolver.resolve).not.toHaveBeenCalled();
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.anything()
    );
  });

  it('works with static-only validator class (regression for DI bug)', async () => {
    // Create a static-only validator class
    class StaticValidator {
      static validate(manifests, loggerArg) {
        loggerArg.debug('StaticValidator.validate called');
      }
    }
    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator: StaticValidator, // Pass the class itself
      modVersionValidator,
      modLoadOrderResolver,
    });
    const requestedIds = ['modA', 'modB'];
    const result = await processor.processManifests(requestedIds, worldName);
    expect(result.finalModOrder).toEqual(['modA', 'modB']);
    expect(logger.debug).toHaveBeenCalledWith(
      'StaticValidator.validate called'
    );
  });

  it('propagates generic errors from version validator without warnings', async () => {
    const error = new Error('boom');
    modVersionValidator.mockImplementation(() => {
      throw error;
    });

    await expect(processor.processManifests(['modA'], worldName)).rejects.toBe(
      error
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.anything()
    );
  });

  it('loads dependency manifests recursively', async () => {
    // Set up modA with a dependency on modC
    manifestMap = new Map([
      [
        'moda',
        {
          id: 'modA',
          version: '1.0.0',
          dependencies: [{ id: 'modC', version: '^1.0.0' }],
        },
      ],
    ]);
    const secondMap = new Map([['modc', { id: 'modC', version: '1.0.0' }]]);

    manifestLoader = new DummyManifestLoader(manifestMap);
    modLoadOrderResolver.resolve.mockReturnValue(['modC', 'modA']);

    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });

    // First call returns modA, second call returns modC
    manifestLoader.loadRequestedManifests
      .mockImplementationOnce(async () => manifestMap)
      .mockImplementationOnce(async () => secondMap);

    const result = await processor.processManifests(['modA'], worldName);

    // Should load modA first, then discover and load its dependency modC
    expect(manifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(2);
    expect(manifestLoader.loadRequestedManifests).toHaveBeenNthCalledWith(
      1,
      ['modA'],
      worldName
    );
    expect(manifestLoader.loadRequestedManifests).toHaveBeenNthCalledWith(
      2,
      ['modC'],
      worldName
    );

    expect(registry.store).toHaveBeenCalledWith('mod_manifests', 'modc', {
      id: 'modC',
      version: '1.0.0',
    });
    expect(result.finalModOrder).toEqual(['modC', 'modA']);
    expect(result.loadedManifestsMap.size).toBe(2);
  });

  it('handles empty requested IDs without attempting to load manifests', async () => {
    modLoadOrderResolver.resolve.mockReturnValue([]);

    const result = await processor.processManifests([], worldName);

    expect(manifestLoader.loadRequestedManifests).not.toHaveBeenCalled();
    expect(result.loadedManifestsMap.size).toBe(0);
    expect(result.finalModOrder).toEqual([]);
    expect(result.incompatibilityCount).toBe(0);
  });

  it('ignores dependencies lacking identifiers or already loaded', async () => {
    manifestMap = new Map([
      [
        'moda',
        {
          id: 'modA',
          version: '1.0.0',
          dependencies: [{ version: '^1.0.0' }, { id: 'modA' }],
        },
      ],
    ]);

    const secondMap = new Map();
    manifestLoader = new DummyManifestLoader(manifestMap);
    manifestLoader.loadRequestedManifests
      .mockResolvedValueOnce(manifestMap)
      .mockResolvedValueOnce(secondMap);

    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });

    await processor.processManifests(['modA'], worldName);

    expect(manifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(1);
    expect(modLoadOrderResolver.resolve).toHaveBeenCalled();
  });
});

describe('ModManifestProcessor - Optional Orchestrator Dependency', () => {
  let testBed;
  let mockDependencies;

  beforeEach(() => {
    testBed = createTestBed();

    mockDependencies = {
      modManifestLoader: {
        loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
        getLoadedManifests: jest.fn().mockResolvedValue(new Map()),
      },
      logger: testBed.mockLogger,
      registry: {
        store: jest.fn(),
      },
      validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
      modDependencyValidator: {
        validate: jest.fn(),
      },
      modVersionValidator: jest.fn(),
      modLoadOrderResolver: {
        resolve: jest.fn().mockReturnValue(['core']),
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create instance successfully with modValidationOrchestrator present', () => {
      const mockOrchestrator = {
        validateForLoading: jest.fn(),
      };

      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: mockOrchestrator,
        });
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should create instance successfully with modValidationOrchestrator as null', () => {
      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: null,
        });
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should create instance successfully with modValidationOrchestrator as undefined', () => {
      expect(() => {
        const processor = new ModManifestProcessor({
          ...mockDependencies,
          modValidationOrchestrator: undefined,
        });
        expect(processor).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('processManifests - Without Orchestrator', () => {
    let processor;

    beforeEach(() => {
      processor = new ModManifestProcessor({
        ...mockDependencies,
        modValidationOrchestrator: null,
      });
    });

    it('should use traditional validation flow when orchestrator is null', async () => {
      const requestedIds = ['core'];
      const worldName = 'test-world';

      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      const result = await processor.processManifests(requestedIds, worldName);

      expect(result).toBeDefined();
      expect(result.loadedManifestsMap).toBeDefined();
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.incompatibilityCount).toBe(0);

      expect(
        mockDependencies.modDependencyValidator.validate
      ).toHaveBeenCalled();
      expect(mockDependencies.modVersionValidator).toHaveBeenCalled();
    });

    it('should not attempt orchestrator validation when orchestrator is null', async () => {
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true };

      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      const result = await processor.processManifests(
        requestedIds,
        worldName,
        options
      );

      expect(result).toBeDefined();
      expect(result.validationWarnings).toEqual([]);

      expect(
        mockDependencies.modDependencyValidator.validate
      ).toHaveBeenCalled();
    });
  });

  describe('processManifests - With Orchestrator', () => {
    let processor;
    let mockOrchestrator;

    beforeEach(() => {
      mockOrchestrator = {
        validateForLoading: jest.fn(),
      };

      processor = new ModManifestProcessor({
        ...mockDependencies,
        modValidationOrchestrator: mockOrchestrator,
      });
    });

    it('should use orchestrator validation when available and cross-reference validation requested', async () => {
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true };

      const validationResult = {
        canLoad: true,
        warnings: ['test warning'],
        loadOrder: ['core'],
        recommendations: [],
      };

      mockOrchestrator.validateForLoading.mockResolvedValue(validationResult);
      mockDependencies.modManifestLoader.getLoadedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      const result = await processor.processManifests(
        requestedIds,
        worldName,
        options
      );

      expect(result).toBeDefined();
      expect(result.validationWarnings).toEqual(['test warning']);
      expect(result.finalModOrder).toEqual(['core']);

      expect(mockOrchestrator.validateForLoading).toHaveBeenCalledWith(
        requestedIds,
        { strictMode: false, allowWarnings: true }
      );

      expect(testBed.mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        'Loading with 1 validation warnings'
      );
      expect(testBed.mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        '  - test warning'
      );

      expect(
        mockDependencies.modDependencyValidator.validate
      ).not.toHaveBeenCalled();
    });

    it('should fall back to traditional validation when orchestrator fails', async () => {
      const requestedIds = ['core'];
      const worldName = 'test-world';
      const options = { validateCrossReferences: true, strictMode: false };

      mockOrchestrator.validateForLoading.mockRejectedValue(
        new Error('Orchestrator failed')
      );
      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core', version: '1.0.0' }]])
      );

      const result = await processor.processManifests(
        requestedIds,
        worldName,
        options
      );

      expect(result).toBeDefined();
      expect(result.loadedManifestsMap).toBeDefined();

      expect(
        mockDependencies.modDependencyValidator.validate
      ).toHaveBeenCalled();
      expect(mockDependencies.modVersionValidator).toHaveBeenCalled();

      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Validation orchestrator failed, falling back to traditional validation',
        expect.any(Error)
      );
    });

    it('should fall back to traditional validation when orchestrator reports mods cannot load', async () => {
      const requestedIds = ['core'];
      const options = { validateCrossReferences: true };

      mockOrchestrator.validateForLoading.mockResolvedValue({
        canLoad: false,
        warnings: [],
      });
      mockDependencies.modManifestLoader.loadRequestedManifests.mockResolvedValue(
        new Map([['core', { id: 'core' }]])
      );

      const result = await processor.processManifests(
        requestedIds,
        'world',
        options
      );

      expect(result.finalModOrder).toEqual(['core']);
      expect(
        mockDependencies.modDependencyValidator.validate
      ).toHaveBeenCalled();
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Validation orchestrator failed, falling back to traditional validation',
        expect.any(ModDependencyError)
      );
    });

    it('should propagate orchestrator errors in strict mode when mods cannot load', async () => {
      const requestedIds = ['core'];
      const options = { validateCrossReferences: true, strictMode: true };

      mockOrchestrator.validateForLoading.mockResolvedValue({
        canLoad: false,
        warnings: [],
      });

      await expect(
        processor.processManifests(requestedIds, 'world', options)
      ).rejects.toBeInstanceOf(ModDependencyError);

      expect(
        mockDependencies.modDependencyValidator.validate
      ).not.toHaveBeenCalled();
      expect(testBed.mockLogger.warn).not.toHaveBeenCalledWith(
        'Validation orchestrator failed, falling back to traditional validation',
        expect.anything()
      );
    });

    it('should propagate orchestrator error when strict mode is enabled', async () => {
      const failure = new Error('strict failure');
      const requestedIds = ['core'];
      const options = { validateCrossReferences: true, strictMode: true };

      mockOrchestrator.validateForLoading.mockRejectedValue(failure);

      await expect(
        processor.processManifests(requestedIds, 'world', options)
      ).rejects.toBe(failure);

      expect(
        mockDependencies.modDependencyValidator.validate
      ).not.toHaveBeenCalled();
      expect(testBed.mockLogger.warn).not.toHaveBeenCalledWith(
        'Validation orchestrator failed, falling back to traditional validation',
        expect.anything()
      );
    });

    it('should use requested order when orchestrator omits load order', async () => {
      const requestedIds = ['core', 'expansion'];
      const options = { validateCrossReferences: true };

      mockOrchestrator.validateForLoading.mockResolvedValue({
        canLoad: true,
        warnings: undefined,
      });
      mockDependencies.modManifestLoader.getLoadedManifests.mockResolvedValue(
        undefined
      );

      const result = await processor.processManifests(
        requestedIds,
        'world',
        options
      );

      expect(result.finalModOrder).toEqual(requestedIds);
      expect(result.validationWarnings).toEqual([]);
      expect(mockDependencies.registry.store).toHaveBeenCalledWith(
        'meta',
        'final_mod_order',
        requestedIds
      );
    });
  });
});
