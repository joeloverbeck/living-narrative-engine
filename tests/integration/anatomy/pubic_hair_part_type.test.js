import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import {
  ANATOMY_PART_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Pubic Hair Part Type Integration', () => {
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

  it('should select pubic hair entities only for pubic_hair part type', async () => {
    // Load test entity definitions
    testBed.loadEntityDefinitions({
      'anatomy:human_pubic_hair': {
        id: 'anatomy:human_pubic_hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'pubic_hair' },
          'descriptors:hair_style': { style: 'curly' },
          'descriptors:length_hair': { length: 'short' },
        },
      },
      'anatomy:human_hair': {
        id: 'anatomy:human_hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:hair_style': { style: 'wavy' },
          'descriptors:length_hair': { length: 'long' },
        },
      },
    });

    // Test that pubic_hair part type selects only pubic hair entities
    const requirements = {
      partType: 'pubic_hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['pubic_hair'],
      undefined,
      Math.random
    );

    expect(result).toBe('anatomy:human_pubic_hair');
  });

  it('should not select regular hair entities for pubic_hair slots', async () => {
    // Load only regular hair entity (no pubic hair)
    testBed.loadEntityDefinitions({
      'anatomy:human_hair': {
        id: 'anatomy:human_hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:hair_style': { style: 'wavy' },
          'descriptors:length_hair': { length: 'long' },
        },
      },
    });

    // Test that pubic_hair part type rejects regular hair entities
    const requirements = {
      partType: 'pubic_hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    await expect(
      testBed.partSelectionService.selectPart(
        requirements,
        ['pubic_hair'],
        undefined,
        Math.random
      )
    ).rejects.toThrow('No entity definitions found matching anatomy requirements');
  });

  it('should not select pubic hair entities for regular hair slots', async () => {
    // Load both entity types
    testBed.loadEntityDefinitions({
      'anatomy:human_pubic_hair': {
        id: 'anatomy:human_pubic_hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'pubic_hair' },
          'descriptors:hair_style': { style: 'curly' },
          'descriptors:length_hair': { length: 'short' },
        },
      },
      'anatomy:human_hair': {
        id: 'anatomy:human_hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:hair_style': { style: 'wavy' },
          'descriptors:length_hair': { length: 'long' },
        },
      },
    });

    // Test that regular hair part type selects only regular hair entities
    const requirements = {
      partType: 'hair',
      components: [ANATOMY_PART_COMPONENT_ID],
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['hair'],
      undefined,
      Math.random
    );

    expect(result).toBe('anatomy:human_hair');
  });
});