import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';

// Helper to create a mock data registry with getAll implementation
const createMockRegistry = (configs) => ({
  getAll: jest.fn((type) => {
    expect(type).toBe('anatomyFormatting');
    return configs;
  }),
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AnatomyFormattingService', () => {
  let registry;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges configuration objects respecting mod load order', () => {
    registry = createMockRegistry({
      'modA:fmt1': {
        descriptionOrder: ['head', 'torso'],
        groupedParts: ['arm'],
        irregularPlurals: { foot: 'feet' },
        descriptorOrder: ['size'],
      },
      'modB:fmt1': {
        descriptionOrder: ['torso', 'leg'],
        groupedParts: ['arm', 'leg'],
        irregularPlurals: { tooth: 'teeth' },
        descriptorOrder: ['shape'],
      },
    });
    logger = createMockLogger();

    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      modLoadOrder: ['modA', 'modB'],
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['head', 'torso', 'leg']);
    expect(Array.from(service.getGroupedParts())).toEqual(['arm', 'leg']);
    expect(service.getIrregularPlurals()).toEqual({
      foot: 'feet',
      tooth: 'teeth',
    });
    expect(service.getDescriptorOrder()).toEqual(['size', 'shape']);
    expect(logger.debug).toHaveBeenCalledTimes(2); // initialization logs
  });

  it('respects replace merge strategies', () => {
    registry = createMockRegistry({
      'core:fmt': {
        descriptionOrder: ['a'],
        irregularPlurals: { foo: 'foos' },
        descriptorOrder: ['x'],
      },
      'addon:fmt': {
        descriptionOrder: ['b'],
        irregularPlurals: { bar: 'bars' },
        descriptorOrder: ['y'],
        mergeStrategy: { replaceArrays: true, replaceObjects: true },
      },
    });
    logger = createMockLogger();

    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      modLoadOrder: ['core', 'addon'],
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['b']);
    expect(service.getIrregularPlurals()).toEqual({ bar: 'bars' });
    expect(service.getDescriptorOrder()).toEqual(['y']);
  });

  it('throws if accessed before initialization', () => {
    registry = createMockRegistry({});
    logger = createMockLogger();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      modLoadOrder: [],
    });

    expect(() => service.getDescriptionOrder()).toThrow(
      'AnatomyFormattingService not initialized. Call initialize() first.'
    );
  });

  it('does not reinitialize once initialized', () => {
    registry = createMockRegistry({});
    logger = createMockLogger();
    const service = new AnatomyFormattingService({
      dataRegistry: registry,
      logger,
      modLoadOrder: [],
    });

    service.initialize();
    service.initialize();

    expect(logger.debug).toHaveBeenCalledTimes(2); // two debug logs from first initialize only
  });
});
