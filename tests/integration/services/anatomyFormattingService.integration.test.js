/**
 * @file Integration tests for AnatomyFormattingService behavior
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const FINAL_MOD_ORDER_ID = 'final_mod_order';

let logger;
let safeEventDispatcher;

/**
 * @description Helper to create a service instance with seeded registry data.
 * @param {object} [options] - Options for configuring the service.
 * @param {string[]} [options.modLoadOrder] - Ordered list of mod identifiers.
 * @param {object[]} [options.configs] - Formatting configs to register in the data registry.
 * @returns {{service: AnatomyFormattingService, registry: InMemoryDataRegistry}}
 */
function createService({ modLoadOrder = [], configs = [] } = {}) {
  const registry = new InMemoryDataRegistry({ logger });

  if (modLoadOrder) {
    registry.store('meta', FINAL_MOD_ORDER_ID, modLoadOrder);
  }

  configs.forEach((config, index) => {
    const id = config.id || `config_${index}`;
    registry.store('anatomyFormatting', id, { ...config });
  });

  const service = new AnatomyFormattingService({
    dataRegistry: registry,
    logger,
    safeEventDispatcher,
  });

  return { service, registry };
}

beforeEach(() => {
  logger = createMockLogger();
  safeEventDispatcher = createMockSafeEventDispatcher();
  jest.clearAllMocks();
});

describe('AnatomyFormattingService integration', () => {
  it('merges formatting configs according to mod load order and merge strategies', () => {
    const modLoadOrder = ['baseMod', 'addonMod', 'finalMod'];
    const configs = [
      {
        id: 'base',
        _modId: 'baseMod',
        descriptionOrder: ['torso', 'head'],
        groupedParts: ['arms'],
        pairedParts: ['eyes'],
        irregularPlurals: { foot: 'feet' },
        noArticleParts: ['torso'],
        descriptorOrder: ['size', 'shape'],
        descriptorValueKeys: ['value', 'intensity'],
        equipmentIntegration: {
          enabled: true,
          prefix: 'Base: ',
          suffix: '!',
          separator: '; ',
          itemSeparator: ' & ',
          placement: 'after_anatomy',
          extra: 'baseOnly',
        },
        mergeStrategy: {
          replaceArrays: true,
          replaceObjects: true,
        },
      },
      {
        id: 'addon',
        _modId: 'addonMod',
        descriptionOrder: ['head', 'arms', 'legs'],
        groupedParts: ['hands', 'arms'],
        pairedParts: ['arms', 'legs'],
        irregularPlurals: { tooth: 'teeth' },
        descriptorOrder: ['color'],
        descriptorValueKeys: ['shade'],
        noArticleParts: ['hands'],
        equipmentIntegration: {
          separator: ' / ',
          itemSeparator: ' & ',
          placement: 'before_anatomy',
        },
      },
      {
        id: 'final',
        _modId: 'finalMod',
        descriptionOrder: ['crown', 'torso'],
        groupedParts: ['wings'],
        pairedParts: ['wings', 'eyes'],
        irregularPlurals: { child: 'children' },
        descriptorOrder: ['texture', 'luminosity'],
        descriptorValueKeys: ['hue', 'saturation'],
        noArticleParts: ['crown'],
        equipmentIntegration: {
          prefix: 'Final: ',
          suffix: '?',
          itemSeparator: ' :: ',
        },
        mergeStrategy: {
          replaceArrays: true,
        },
      },
    ];

    const { service, registry } = createService({
      modLoadOrder,
      configs,
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['crown', 'torso']);
    expect([...service.getGroupedParts()]).toEqual(['wings']);
    expect([...service.getPairedParts()]).toEqual(['wings', 'eyes']);
    expect(service.getIrregularPlurals()).toEqual({
      foot: 'feet',
      tooth: 'teeth',
      child: 'children',
    });
    expect([...service.getNoArticleParts()]).toEqual(['crown']);
    expect(service.getDescriptorOrder()).toEqual(['texture', 'luminosity']);
    expect(service.getDescriptorValueKeys()).toEqual(['hue', 'saturation']);
    expect(service.getEquipmentIntegrationConfig()).toEqual({
      enabled: true,
      prefix: 'Final: ',
      suffix: '?',
      separator: ' / ',
      itemSeparator: ' :: ',
      placement: 'before_anatomy',
      extra: 'baseOnly',
    });

    expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();

    registry.store('anatomyFormatting', 'late', {
      id: 'late',
      _modId: 'addonMod',
      descriptionOrder: ['should', 'not', 'apply'],
    });

    service.initialize();

    expect(service.getDescriptionOrder()).toEqual(['crown', 'torso']);
  });

  it('throws descriptive error when used before initialization', () => {
    const { service } = createService();

    expect(() => service.getDescriptionOrder()).toThrow(
      'AnatomyFormattingService not initialized. Call initialize() first.'
    );
  });

  it('dispatches system errors when critical configuration is empty', () => {
    const modLoadOrder = ['emptyMod'];
    const configs = [
      {
        id: 'empty',
        _modId: 'emptyMod',
        descriptionOrder: [],
        groupedParts: [],
        pairedParts: [],
        irregularPlurals: {},
        noArticleParts: [],
        descriptorOrder: [],
        descriptorValueKeys: [],
      },
    ];

    const { service } = createService({
      modLoadOrder,
      configs,
    });

    service.initialize();

    expect(service.getEquipmentIntegrationConfig()).toEqual({
      enabled: false,
      prefix: 'Wearing: ',
      suffix: '.',
      separator: ', ',
      itemSeparator: ' | ',
      placement: 'after_anatomy',
    });

    expect(() => service.getDescriptionOrder()).toThrow(
      'AnatomyFormattingService.getDescriptionOrder: descriptionOrder configuration is empty'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'AnatomyFormattingService.getDescriptionOrder: descriptionOrder configuration is empty',
      expect.any(Object)
    );

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'AnatomyFormattingService.getDescriptionOrder: descriptionOrder configuration is empty',
      })
    );

    expect(() => service.getIrregularPlurals()).toThrow(
      'AnatomyFormattingService.getIrregularPlurals: irregularPlurals configuration is empty'
    );

    expect(safeEventDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'AnatomyFormattingService.getIrregularPlurals: irregularPlurals configuration is empty',
      })
    );
  });
});
