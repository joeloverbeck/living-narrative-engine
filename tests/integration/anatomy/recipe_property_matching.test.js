import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_PART_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Recipe Property Matching Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    // Load anatomy part component
    testBed.loadComponents({
      [ANATOMY_PART_COMPONENT_ID]: {
        id: ANATOMY_PART_COMPONENT_ID,
        data: { subType: null },
      },
    });
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should match entities with additional properties beyond recipe requirements', async () => {
    // Load entity that has MORE properties than required by recipe
    testBed.loadEntityDefinitions({
      'anatomy:human_hair_extra': {
        id: 'anatomy:human_hair_extra',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': {
            color: 'blonde',
            intensity: 'bright', // Additional property not in recipe
          },
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'wavy' },
          'descriptors:texture': { texture: 'smooth' }, // Additional property
        },
      },
    });

    // Recipe requirements (subset of entity properties)
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const recipeSlot = {
      properties: {
        'descriptors:color_extended': {
          color: 'blonde', // Only requires color, not intensity
        },
        'descriptors:length_hair': { length: 'long' },
        'descriptors:hair_style': { style: 'wavy' },
      },
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['hair'],
      recipeSlot,
      Math.random
    );

    expect(result).toBe('anatomy:human_hair_extra');
  });

  it('should match entities with all required properties and ignore extra properties', async () => {
    // Load multiple entities with different property combinations
    testBed.loadEntityDefinitions({
      'anatomy:hair_minimal': {
        id: 'anatomy:hair_minimal',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': { color: 'blonde' },
        },
      },
      'anatomy:hair_extended': {
        id: 'anatomy:hair_extended',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': {
            color: 'blonde',
            intensity: 'bright',
            highlight: 'subtle',
          },
          'descriptors:texture': { texture: 'silky' },
          'descriptors:maintenance': { level: 'high' },
        },
      },
    });

    // Recipe only requires color
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const recipeSlot = {
      properties: {
        'descriptors:color_extended': { color: 'blonde' },
      },
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['hair'],
      recipeSlot,
      Math.random
    );

    // Should match either entity (both have required property)
    expect(['anatomy:hair_minimal', 'anatomy:hair_extended']).toContain(result);
  });

  it('should reject entities with mismatching property values', async () => {
    // Load entities with different property values
    testBed.loadEntityDefinitions({
      'anatomy:hair_brown': {
        id: 'anatomy:hair_brown',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': { color: 'brown' }, // Different color
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'wavy' },
        },
      },
      'anatomy:hair_blonde': {
        id: 'anatomy:hair_blonde',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': { color: 'blonde' }, // Matches recipe
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'wavy' },
        },
      },
    });

    // Recipe specifies blonde - should filter to only blonde entities
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const recipeSlot = {
      properties: {
        'descriptors:color_extended': { color: 'blonde' },
        'descriptors:length_hair': { length: 'long' },
      },
    };

    // Selection should succeed and select the matching entity
    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['hair'],
      recipeSlot,
      Math.random
    );

    // Should select blonde hair, NOT brown hair
    expect(result).toBe('anatomy:hair_blonde');
  });

  it('should handle complex property matching scenarios like Amaia Castillo recipe', async () => {
    // Simulate the Amaia Castillo recipe scenario
    testBed.loadEntityDefinitions({
      'anatomy:human_hair_amaia': {
        id: 'anatomy:human_hair_amaia',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': {
            color: 'blonde',
            intensity: 'bright',
            undertone: 'golden',
          },
          'descriptors:length_hair': {
            length: 'long',
            layers: true,
          },
          'descriptors:hair_style': {
            style: 'wavy',
            volume: 'high',
          },
        },
      },
    });

    // Recipe requirements from Amaia Castillo (subset matching)
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const recipeSlot = {
      properties: {
        'descriptors:color_extended': { color: 'blonde' },
        'descriptors:length_hair': { length: 'long' },
        'descriptors:hair_style': { style: 'wavy' },
      },
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['hair'],
      recipeSlot,
      Math.random
    );

    expect(result).toBe('anatomy:human_hair_amaia');
  });
});
