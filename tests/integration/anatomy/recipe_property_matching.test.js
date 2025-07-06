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

  it('should not match entities missing required properties', async () => {
    // Load entity that's missing a required property
    testBed.loadEntityDefinitions({
      'anatomy:hair_incomplete': {
        id: 'anatomy:hair_incomplete',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': { color: 'brown' }, // Wrong color
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'wavy' },
        },
      },
    });

    // Recipe requires specific color
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const recipeSlot = {
      properties: {
        'descriptors:color_extended': { color: 'blonde' }, // Required but not present
        'descriptors:length_hair': { length: 'long' },
      },
    };

    await expect(
      testBed.partSelectionService.selectPart(
        requirements,
        ['hair'],
        recipeSlot,
        Math.random
      )
    ).rejects.toThrow(
      'No entity definitions found matching anatomy requirements'
    );
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
