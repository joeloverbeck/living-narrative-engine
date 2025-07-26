import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';

// Helper to create a mock data registry with getAll and get implementation
const createMockRegistry = (configs, mods = ['core', 'modA']) => ({
  getAll: jest.fn((type) => {
    expect(type).toBe('anatomyFormatting');
    return configs;
  }),
  get: jest.fn((type, id) => {
    if (type === 'meta' && id === 'final_mod_order') {
      return mods;
    }
    return null;
  }),
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

describe('AnatomyFormattingService', () => {
  let registry;
  let logger;
  let safeEventDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges configuration objects respecting mod load order', () => {
    registry = createMockRegistry([
      {
        _modId: 'core',
        descriptionOrder: ['head', 'torso'],
        groupedParts: ['arm'],
        irregularPlurals: { foot: 'feet' },
        descriptorOrder: ['size'],
      },
      {
        _modId: 'modA',
        descriptionOrder: ['torso', 'leg'],
        groupedParts: ['arm', 'leg'],
        irregularPlurals: { tooth: 'teeth' },
        descriptorOrder: ['shape'],
      },
    ]);
    logger = createMockLogger();

    safeEventDispatcher = createMockSafeEventDispatcher();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      safeEventDispatcher,
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['head', 'torso', 'leg']);
    expect(Array.from(service.getGroupedParts())).toEqual(['arm', 'leg']);
    expect(service.getIrregularPlurals()).toEqual({
      foot: 'feet',
      tooth: 'teeth',
    });
    expect(service.getDescriptorOrder()).toEqual(['size', 'shape']);
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyFormattingService: Configuration initialized',
      expect.objectContaining({
        descriptionOrderCount: 3,
        descriptorOrderCount: 2,
      })
    );
  });

  it('respects replace merge strategies', () => {
    registry = createMockRegistry(
      [
        {
          _modId: 'core',
          descriptionOrder: ['a'],
          irregularPlurals: { foo: 'foos' },
          descriptorOrder: ['x'],
        },
        {
          _modId: 'addon',
          descriptionOrder: ['b'],
          irregularPlurals: { bar: 'bars' },
          descriptorOrder: ['y'],
          mergeStrategy: { replaceArrays: true, replaceObjects: true },
        },
      ],
      ['core', 'addon']
    );
    logger = createMockLogger();

    safeEventDispatcher = createMockSafeEventDispatcher();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      safeEventDispatcher,
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['b']);
    expect(service.getIrregularPlurals()).toEqual({ bar: 'bars' });
    expect(service.getDescriptorOrder()).toEqual(['y']);
  });

  it('throws if accessed before initialization', () => {
    registry = createMockRegistry([]);
    logger = createMockLogger();
    safeEventDispatcher = createMockSafeEventDispatcher();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      safeEventDispatcher,
    });

    expect(() => service.getDescriptionOrder()).toThrow(
      'AnatomyFormattingService not initialized. Call initialize() first.'
    );
  });

  it('does not reinitialize once initialized', () => {
    registry = createMockRegistry([]);
    logger = createMockLogger();
    safeEventDispatcher = createMockSafeEventDispatcher();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      safeEventDispatcher,
    });

    service.initialize();
    service.initialize();

    expect(logger.debug).toHaveBeenCalledTimes(6); // six debug logs from first initialize only
  });

  describe('empty configuration validation', () => {
    beforeEach(() => {
      registry = createMockRegistry([]);
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();
    });

    it('throws and dispatches error when descriptionOrder is empty', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      expect(() => service.getDescriptionOrder()).toThrow(
        'AnatomyFormattingService.getDescriptionOrder: descriptionOrder configuration is empty'
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('descriptionOrder configuration is empty'),
        expect.objectContaining({
          method: 'getDescriptionOrder',
          configKey: 'descriptionOrder',
          impact: 'Body part descriptions will be incomplete or empty',
          suggestion:
            'Ensure "anatomy" mod is loaded in /data/game.json mods list',
        })
      );

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'descriptionOrder configuration is empty'
          ),
          details: expect.objectContaining({
            raw: expect.any(String),
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('throws and dispatches error when pairedParts is empty', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      expect(() => service.getPairedParts()).toThrow(
        'AnatomyFormattingService.getPairedParts: pairedParts configuration is empty'
      );

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.any(Object)
      );
    });

    it('throws and dispatches error when descriptorOrder is empty', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      expect(() => service.getDescriptorOrder()).toThrow(
        'AnatomyFormattingService.getDescriptorOrder: descriptorOrder configuration is empty'
      );
    });

    it('throws and dispatches error when irregularPlurals is empty', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      expect(() => service.getIrregularPlurals()).toThrow(
        'AnatomyFormattingService.getIrregularPlurals: irregularPlurals configuration is empty'
      );
    });

    it('throws and dispatches error when descriptorValueKeys is empty', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      expect(() => service.getDescriptorValueKeys()).toThrow(
        'AnatomyFormattingService.getDescriptorValueKeys: descriptorValueKeys configuration is empty'
      );
    });

    it('does not throw for optional empty configurations', () => {
      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });
      service.initialize();

      // These should not throw as they are optional
      expect(() => service.getGroupedParts()).not.toThrow();
      expect(() => service.getNoArticleParts()).not.toThrow();

      // Should return empty sets
      expect(service.getGroupedParts().size).toBe(0);
      expect(service.getNoArticleParts().size).toBe(0);
    });
  });

  it('handles missing final_mod_order gracefully', () => {
    // Create registry that returns null for final_mod_order
    const registryWithNoModOrder = {
      getAll: jest.fn((type) => {
        expect(type).toBe('anatomyFormatting');
        return [];
      }),
      get: jest.fn((type, id) => {
        if (type === 'meta' && id === 'final_mod_order') {
          return null; // Simulating missing mod order
        }
        return null;
      }),
    };

    logger = createMockLogger();
    safeEventDispatcher = createMockSafeEventDispatcher();

    const service = new AnatomyFormattingService({
      dataRegistry: registryWithNoModOrder,
      logger,
      safeEventDispatcher,
    });

    // Should not throw during initialization
    expect(() => service.initialize()).not.toThrow();

    // Should log empty mod order
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyFormattingService: Using mod load order: []'
    );
  });

  it('validates constructor dependencies', () => {
    expect(() => {
      new AnatomyFormattingService({
        dataRegistry: null,
        logger,
        safeEventDispatcher: createMockSafeEventDispatcher(),
      });
    }).toThrow();

    expect(() => {
      new AnatomyFormattingService({
        dataRegistry: createMockRegistry([]),
        logger: null,
        safeEventDispatcher: createMockSafeEventDispatcher(),
      });
    }).toThrow();

    expect(() => {
      new AnatomyFormattingService({
        dataRegistry: createMockRegistry([]),
        logger,
        safeEventDispatcher: null,
      });
    }).toThrow();
  });

  describe('equipment integration configuration', () => {
    it('merges equipment integration config without replace strategy', () => {
      registry = createMockRegistry([
        {
          _modId: 'core',
          descriptionOrder: ['head'],
          descriptorOrder: ['size'],
          equipmentIntegration: {
            enabled: true,
            prefix: 'Wearing: ',
            separator: ', ',
          },
        },
        {
          _modId: 'modA',
          descriptionOrder: ['torso'],
          descriptorOrder: ['shape'],
          equipmentIntegration: {
            enabled: false,
            suffix: '.',
            itemSeparator: ' | ',
          },
        },
      ]);
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      const config = service.getEquipmentIntegrationConfig();
      expect(config).toEqual({
        enabled: false,
        prefix: 'Wearing: ',
        separator: ', ',
        suffix: '.',
        itemSeparator: ' | ',
      });
    });

    it('replaces equipment integration config with replace strategy', () => {
      registry = createMockRegistry(
        [
          {
            _modId: 'core',
            descriptionOrder: ['head'],
            descriptorOrder: ['size'],
            equipmentIntegration: {
              enabled: true,
              prefix: 'Wearing: ',
              separator: ', ',
              placement: 'before_anatomy',
            },
          },
          {
            _modId: 'modA',
            descriptionOrder: ['torso'],
            descriptorOrder: ['shape'],
            equipmentIntegration: {
              enabled: false,
              suffix: '!',
            },
            mergeStrategy: { replaceObjects: true },
          },
        ],
        ['core', 'modA']
      );
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      const config = service.getEquipmentIntegrationConfig();
      expect(config).toEqual({
        enabled: false,
        suffix: '!',
      });
    });

    it('returns default equipment integration config when none provided', () => {
      registry = createMockRegistry([
        {
          _modId: 'core',
          descriptionOrder: ['head'],
          descriptorOrder: ['size'],
        },
      ]);
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      const config = service.getEquipmentIntegrationConfig();
      expect(config).toEqual({
        enabled: false,
        prefix: 'Wearing: ',
        suffix: '.',
        separator: ', ',
        itemSeparator: ' | ',
        placement: 'after_anatomy',
      });
    });
  });

  describe('getPairedParts return value', () => {
    it('returns a new Set instance, not the internal reference', () => {
      registry = createMockRegistry([
        {
          _modId: 'core',
          descriptionOrder: ['head'],
          pairedParts: ['arm', 'leg'],
          descriptorOrder: ['size'],
        },
      ]);
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      const pairedParts1 = service.getPairedParts();
      const pairedParts2 = service.getPairedParts();

      // Should return new instances
      expect(pairedParts1).not.toBe(pairedParts2);

      // But with same content
      expect(Array.from(pairedParts1)).toEqual(Array.from(pairedParts2));
      expect(Array.from(pairedParts1)).toEqual(['arm', 'leg']);
    });
  });

  describe('_validateConfiguration edge cases', () => {
    beforeEach(() => {
      logger = createMockLogger();
      safeEventDispatcher = createMockSafeEventDispatcher();
    });

    it('validates Set type configurations correctly', () => {
      registry = createMockRegistry([
        {
          _modId: 'core',
          descriptionOrder: ['head'],
          descriptorOrder: ['size'],
        },
      ]);

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      // Create a custom method to test Set validation
      const testSet = new Set();

      expect(() => {
        service._validateConfiguration('testSet', testSet, 'testMethod');
      }).toThrow(
        'AnatomyFormattingService.testMethod: testSet configuration is empty'
      );
    });

    it('validates non-object, non-array, non-set values correctly', () => {
      registry = createMockRegistry([
        {
          _modId: 'core',
          descriptionOrder: ['head'],
          descriptorOrder: ['size'],
        },
      ]);

      const service = new AnatomyFormattingService({
        dataRegistry: registry,
        logger,
        safeEventDispatcher,
      });

      service.initialize();

      // Test with null value
      expect(() => {
        service._validateConfiguration('testValue', null, 'testMethod');
      }).toThrow(
        'AnatomyFormattingService.testMethod: testValue configuration is empty'
      );

      // Test with undefined value
      expect(() => {
        service._validateConfiguration('testValue', undefined, 'testMethod');
      }).toThrow(
        'AnatomyFormattingService.testMethod: testValue configuration is empty'
      );

      // Test with empty string
      expect(() => {
        service._validateConfiguration('testValue', '', 'testMethod');
      }).toThrow(
        'AnatomyFormattingService.testMethod: testValue configuration is empty'
      );

      // Test with false boolean
      expect(() => {
        service._validateConfiguration('testValue', false, 'testMethod');
      }).toThrow(
        'AnatomyFormattingService.testMethod: testValue configuration is empty'
      );
    });
  });
});
