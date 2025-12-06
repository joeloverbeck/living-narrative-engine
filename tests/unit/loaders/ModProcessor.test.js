import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ModProcessor } from '../../../src/loaders/ModProcessor.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';

describe('ModProcessor', () => {
  /** @type {jest.Mocked<any>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let validatedEventDispatcher;
  /** @type {jest.Mock} */
  let aggregatorFactory;
  /** @type {jest.Mock} */
  let timer;
  /** @type {jest.Mocked<LoadResultAggregator>} */
  let mockAggregator;
  /** @type {ModProcessor} */
  let processor;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    validatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockAggregator = {
      getTotalCounts: jest.fn().mockReturnValue({}),
      getModResults: jest.fn().mockReturnValue({}),
      aggregate: jest.fn(),
      recordFailure: jest.fn(),
    };

    aggregatorFactory = jest.fn().mockReturnValue(mockAggregator);
    timer = jest.fn().mockReturnValue(1000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      processor = new ModProcessor({
        logger,
        validatedEventDispatcher,
        aggregatorFactory,
        timer,
      });

      expect(processor).toBeInstanceOf(ModProcessor);
    });

    it('should use default aggregatorFactory when not provided', async () => {
      processor = new ModProcessor({
        logger,
        validatedEventDispatcher,
        timer,
      });

      // Test that default factory works by calling it
      const result = processor.processMod('test', null, {}, [], 'definitions');
      await expect(result).resolves.toBeDefined();
    });

    it('should use default timer when not provided', () => {
      processor = new ModProcessor({
        logger,
        validatedEventDispatcher,
        aggregatorFactory,
      });

      expect(processor).toBeInstanceOf(ModProcessor);
    });

    it('should use both defaults when neither aggregatorFactory nor timer provided', () => {
      processor = new ModProcessor({
        logger,
        validatedEventDispatcher,
      });

      expect(processor).toBeInstanceOf(ModProcessor);
    });
  });

  describe('processMod', () => {
    beforeEach(() => {
      processor = new ModProcessor({
        logger,
        validatedEventDispatcher,
        aggregatorFactory,
        timer,
      });
    });

    it('should process mod successfully with manifest and content', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const totalCounts = {};
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 1,
              overrides: 0,
              errors: 0,
              failures: [],
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      timer.mockReturnValueOnce(1000).mockReturnValueOnce(1100); // start and end

      const result = await processor.processMod(
        'test-mod',
        manifest,
        totalCounts,
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('success');
      expect(aggregatorFactory).toHaveBeenCalledWith(totalCounts);
      expect(logger.debug).toHaveBeenCalledWith(
        '--- Loading content for mod: test-mod, phase: definitions ---'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Content loading loop took 100.00 ms')
      );
    });

    it('should skip mod when manifest is null', async () => {
      const totalCounts = {};
      const phaseLoaders = [];

      const result = await processor.processMod(
        'test-mod',
        null,
        totalCounts,
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('skipped');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Manifest not found in registry for mod ID 'test-mod'"
        )
      );
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'initialization:world_loader:mod_load_failed',
        expect.objectContaining({
          modId: 'test-mod',
          reason: expect.stringContaining('Manifest not found'),
        }),
        { allowSchemaNotFound: true }
      );
    });

    it('should set status to skipped when no content in phase and status is not failed', async () => {
      const manifest = {
        id: 'test-mod',
        content: {}, // Empty content
      };
      const totalCounts = {};
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 0,
              overrides: 0,
              errors: 0,
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        totalCounts,
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('skipped');
    });

    it('loads anatomy structure templates using dashed manifest key', async () => {
      const manifest = {
        id: 'anatomy',
        content: {
          'structure-templates': [
            'structure-templates/structure_octopoid.structure-template.json',
          ],
        },
      };
      const totalCounts = {};
      const loader = {
        constructor: { name: 'AnatomyStructureTemplateLoader' },
        loadItemsForMod: jest.fn().mockResolvedValue({
          count: 1,
          overrides: 0,
          errors: 0,
          failures: [],
        }),
      };
      const phaseLoaders = [
        {
          loader,
          contentKey: 'structure-templates',
          diskFolder: 'structure-templates',
          registryKey: 'anatomyStructureTemplates',
        },
      ];

      timer.mockReturnValueOnce(2000).mockReturnValueOnce(2085);

      const result = await processor.processMod(
        'anatomy',
        manifest,
        totalCounts,
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('success');
      expect(loader.loadItemsForMod).toHaveBeenCalledWith(
        'anatomy',
        manifest,
        'structure-templates',
        'structure-templates',
        'anatomyStructureTemplates'
      );
      expect(mockAggregator.aggregate).toHaveBeenCalledWith(
        {
          count: 1,
          overrides: 0,
          errors: 0,
          failures: [],
        },
        'anatomyStructureTemplates'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ModsLoader [anatomy, definitions]: Processing structure-templates content with 1 files...'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "ModsLoader [anatomy, definitions]: Found content for 'structure-templates'. Invoking loader 'AnatomyStructureTemplateLoader'."
      );
    });

    it('should handle unexpected errors during processing', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const error = new Error('Unexpected error');

      // Mock timer to throw error
      timer.mockImplementation(() => {
        throw error;
      });

      await expect(
        processor.processMod('test-mod', manifest, {}, [], 'definitions')
      ).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error during processing'),
        expect.objectContaining({ modId: 'test-mod', phase: 'definitions' }),
        error
      );
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'initialization:world_loader:mod_load_failed',
        expect.objectContaining({
          modId: 'test-mod',
          reason: expect.stringContaining(
            'Unexpected error in phase definitions'
          ),
        }),
        { allowSchemaNotFound: true }
      );
    });

    it('should handle loader failures with error details', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 1,
              overrides: 0,
              errors: 1,
              failures: [
                {
                  file: 'action1.json',
                  error: new Error('Parse error'),
                },
              ],
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('success');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "actions file 'action1.json' failed: Parse error"
        ),
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          phase: 'definitions',
          file: 'action1.json',
        }),
        expect.any(Error)
      );
    });

    it('should handle loader returning unexpected result format', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue(null), // Invalid result
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Loader for 'actions' returned an unexpected result format"
        ),
        expect.objectContaining({ result: null })
      );
      expect(mockAggregator.aggregate).toHaveBeenCalledWith(null, 'actions');
    });

    it('should handle loader throwing exception', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const loaderError = new Error('Loader crashed');
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockRejectedValue(loaderError),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading content type 'actions'"),
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          phase: 'definitions',
          error: 'Loader crashed',
        }),
        loaderError
      );
      expect(mockAggregator.recordFailure).toHaveBeenCalledWith('actions');
      expect(validatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'initialization:world_loader:content_load_failed',
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          error: 'Loader crashed',
          phase: 'definitions',
        }),
        { allowSchemaNotFound: true }
      );
    });

    it('should handle event dispatch failure during loader error', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const loaderError = new Error('Loader crashed');
      const dispatchError = new Error('Event dispatch failed');
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockRejectedValue(loaderError),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      validatedEventDispatcher.dispatch.mockRejectedValue(dispatchError);

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed dispatching content_load_failed event'),
        dispatchError
      );
    });

    it('should skip content types with no manifest content', async () => {
      const manifest = {
        id: 'test-mod',
        content: {}, // No actions defined
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn(),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Skipping content type 'actions' (key: 'actions') as it's not defined or empty"
        )
      );
      expect(phaseLoaders[0].loader.loadItemsForMod).not.toHaveBeenCalled();
    });

    it('should handle mod failure event dispatch error', async () => {
      const dispatchError = new Error('Dispatch failed');
      validatedEventDispatcher.dispatch.mockRejectedValue(dispatchError);

      const result = await processor.processMod(
        'test-mod',
        null,
        {},
        [],
        'definitions'
      );

      expect(result.status).toBe('skipped');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed dispatching mod_load_failed event for test-mod'
        ),
        dispatchError
      );
    });

    it('should handle failure array with error objects and string errors', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json', 'action2.json'],
        },
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 1,
              overrides: 0,
              errors: 2,
              failures: [
                {
                  file: 'action1.json',
                  error: new Error('Parse error'),
                },
                {
                  file: 'action2.json',
                  error: 'String error message',
                },
              ],
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(result.status).toBe('success');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "actions file 'action1.json' failed: Parse error"
        ),
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          phase: 'definitions',
          file: 'action1.json',
        }),
        expect.any(Error)
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "actions file 'action2.json' failed: String error message"
        ),
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          phase: 'definitions',
          file: 'action2.json',
        }),
        'String error message'
      );
    });

    it('should build summary message correctly with overrides and errors', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 3,
              overrides: 2,
              errors: 1,
              failures: [],
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      // Mock aggregator to return realistic data for summary
      mockAggregator.getModResults.mockReturnValue({
        actions: { count: 3, overrides: 2, errors: 1 },
      });

      timer.mockReturnValueOnce(1000).mockReturnValueOnce(1250); // 250ms duration

      await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Mod 'test-mod' phase 'definitions' loaded in 250.00ms"
        )
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('actions(3 E:1)')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Overrides(2), Errors(1)')
      );
    });

    it('should handle phase with no items processed', async () => {
      const manifest = {
        id: 'test-mod',
        content: {},
      };

      // Mock aggregator to return empty results
      mockAggregator.getModResults.mockReturnValue({});

      timer.mockReturnValueOnce(1000).mockReturnValueOnce(1100); // 100ms duration

      const result = await processor.processMod(
        'test-mod',
        manifest,
        {},
        [],
        'definitions'
      );

      expect(result.status).toBe('skipped');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Mod 'test-mod' phase 'definitions' loaded in 100.00ms: No items processed in this phase-> Overrides(0), Errors(0)"
        )
      );
    });

    it('should handle failure with undefined error message', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          actions: ['action1.json'],
        },
      };
      const phaseLoaders = [
        {
          loader: {
            constructor: { name: 'TestLoader' },
            loadItemsForMod: jest.fn().mockResolvedValue({
              count: 0,
              overrides: 0,
              errors: 1,
              failures: [
                {
                  file: 'action1.json',
                  error: undefined,
                },
              ],
            }),
          },
          contentKey: 'actions',
          diskFolder: 'actions',
          registryKey: 'actions',
        },
      ];

      await processor.processMod(
        'test-mod',
        manifest,
        {},
        phaseLoaders,
        'definitions'
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "actions file 'action1.json' failed: undefined"
        ),
        expect.objectContaining({
          modId: 'test-mod',
          registryKey: 'actions',
          phase: 'definitions',
          file: 'action1.json',
          error: 'undefined',
        }),
        undefined
      );
    });
  });
});
