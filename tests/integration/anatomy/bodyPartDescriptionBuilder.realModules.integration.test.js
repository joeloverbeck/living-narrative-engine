import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

const FINAL_MOD_ORDER_ID = 'final_mod_order';

/**
 * Helper to create a fully initialized AnatomyFormattingService with test data.
 * @param {object} [options]
 * @param {string[]} [options.descriptorOrder]
 * @param {string[]} [options.descriptorValueKeys]
 * @param {string[]} [options.pairedParts]
 * @param {Record<string, string>} [options.irregularPlurals]
 * @returns {AnatomyFormattingService}
 */
function createFormattingService({
  descriptorOrder = [
    'descriptors:color_extended',
    'descriptors:shape_general',
    'descriptors:length_category',
  ],
  descriptorValueKeys = ['color', 'value', 'length'],
  pairedParts = [],
  irregularPlurals = {},
} = {}) {
  const logger = createMockLogger();
  const safeEventDispatcher = createMockSafeEventDispatcher();
  const registry = new InMemoryDataRegistry({ logger });

  registry.store('meta', FINAL_MOD_ORDER_ID, ['integration-mod']);
  registry.store('anatomyFormatting', 'integration-config', {
    id: 'integration-config',
    _modId: 'integration-mod',
    descriptorOrder,
    descriptorValueKeys,
    pairedParts,
    irregularPlurals,
  });

  const service = new AnatomyFormattingService({
    dataRegistry: registry,
    logger,
    safeEventDispatcher,
  });
  service.initialize();
  return service;
}

/**
 * Builds a BodyPartDescriptionBuilder with a fully initialized formatting service.
 * @param {object} [options]
 * @param {string[]} [options.descriptorOrder]
 * @param {string[]} [options.descriptorValueKeys]
 * @param {string[]} [options.pairedParts]
 * @param {Record<string, string>} [options.irregularPlurals]
 */
function createBuilderWithService(options = {}) {
  const anatomyFormattingService = createFormattingService(options);
  const descriptorFormatter = new DescriptorFormatter({
    anatomyFormattingService,
  });

  return new BodyPartDescriptionBuilder({
    descriptorFormatter,
    anatomyFormattingService,
  });
}

/**
 * Creates an entity that exposes data through getComponentData to exercise
 * the private extraction helper.
 * @param {string} id
 * @param {Record<string, any>} componentMap
 * @param {string[]} [throwOn]
 * @returns {{id: string, getComponentData: Function}}
 */
function createEntityWithComponentData(id, componentMap, throwOn = []) {
  return {
    id,
    getComponentData(componentId) {
      if (throwOn.includes(componentId)) {
        throw new Error(`Missing component ${componentId}`);
      }
      return componentMap[componentId];
    },
  };
}

describe('BodyPartDescriptionBuilder real modules integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds descriptions using component extraction and formatting service ordering', () => {
    const builder = createBuilderWithService({
      descriptorOrder: [
        'descriptors:color_extended',
        'descriptors:shape_general',
        'descriptors:length_category',
      ],
      descriptorValueKeys: ['tone', 'form', 'length'],
    });

    const componentMap = {
      'anatomy:part': { subType: 'tentacle' },
      'descriptors:color_extended': { tone: 'deep crimson' },
      'descriptors:shape_general': { form: 'spiral' },
      'descriptors:length_category': { length: 'elongated' },
    };

    const entity = createEntityWithComponentData(
      'tentacle-1',
      componentMap,
      ['descriptors:hair_style']
    );

    const description = builder.buildDescription(entity);
    expect(description).toBe('deep crimson, spiral, elongated');
  });

  it('collapses identical descriptors for paired parts using formatting service configuration', () => {
    const builder = createBuilderWithService({
      descriptorOrder: [
        'descriptors:color_extended',
        'descriptors:length_category',
      ],
      descriptorValueKeys: ['color', 'length'],
      pairedParts: ['tentacle'],
    });

    const first = createEntityWithComponentData('tentacle-1', {
      'anatomy:part': { subType: 'tentacle' },
      'descriptors:color_extended': { color: 'emerald' },
      'descriptors:length_category': { length: 'long' },
    });
    const second = createEntityWithComponentData('tentacle-2', {
      'anatomy:part': { subType: 'tentacle' },
      'descriptors:color_extended': { color: 'emerald' },
      'descriptors:length_category': { length: 'long' },
    });

    const description = builder.buildMultipleDescription(
      [first, second],
      'tentacle'
    );

    expect(description).toBe('emerald, long');
  });

  it('returns distinct descriptor list for non-paired parts', () => {
    const builder = createBuilderWithService({
      descriptorOrder: [
        'descriptors:color_extended',
        'descriptors:shape_general',
        'descriptors:length_category',
      ],
      descriptorValueKeys: ['color', 'value', 'length'],
      pairedParts: ['tentacle'],
    });

    const directEntity = {
      id: 'claw-1',
      components: {
        'anatomy:part': { subType: 'claw' },
        'descriptors:color_extended': { color: 'obsidian' },
      },
    };

    const nullEntry = null;

    const extractedEntity = createEntityWithComponentData('claw-2', {
      'anatomy:part': { subType: 'claw' },
      'descriptors:shape_general': { value: 'razor-edged' },
    });

    const description = builder.buildMultipleDescription(
      [directEntity, nullEntry, extractedEntity],
      'claw'
    );

    expect(description).toEqual(['obsidian', 'razor-edged']);
  });

  it('pluralizes body parts using service irregulars and default fallbacks', () => {
    const builderWithService = createBuilderWithService({
      irregularPlurals: { antenna: 'antennae' },
    });

    const builderWithDefaults = new BodyPartDescriptionBuilder({
      descriptorFormatter: new DescriptorFormatter(),
    });

    expect(builderWithService.getPlural('antenna')).toBe('antennae');
    expect(builderWithService.getPlural('class')).toBe('classes');

    expect(builderWithDefaults.getPlural('foot')).toBe('feet');
    expect(builderWithDefaults.getPlural('box')).toBe('boxes');
    expect(builderWithDefaults.getPlural('brush')).toBe('brushes');
    expect(builderWithDefaults.getPlural('colony')).toBe('colonies');
    expect(builderWithDefaults.getPlural('arm')).toBe('arms');
  });
});
