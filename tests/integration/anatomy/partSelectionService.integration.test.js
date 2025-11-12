import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_PART_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const RNG_FIRST = () => 0;

describe('PartSelectionService Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadComponents({
      [ANATOMY_PART_COMPONENT_ID]: {
        id: ANATOMY_PART_COMPONENT_ID,
        data: { subType: null },
      },
      'tags:organic': { id: 'tags:organic', data: {} },
      'tags:elite': { id: 'tags:elite', data: {} },
      'tags:injured': { id: 'tags:injured', data: {} },
      'descriptors:length_arm': {
        id: 'descriptors:length_arm',
        data: { length: null },
      },
      'descriptors:material': {
        id: 'descriptors:material',
        data: { type: null },
      },
    });
  });

  afterEach(async () => {
    await testBed?.cleanup();
    testBed = null;
  });

  it('uses preferId when the preferred entity satisfies all requirements', async () => {
    testBed.loadEntityDefinitions({
      'anatomy:preferred_arm': {
        id: 'anatomy:preferred_arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
          'tags:elite': {},
        },
      },
      'anatomy:backup_arm': {
        id: 'anatomy:backup_arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
        },
      },
    });

    const requirements = {
      partType: 'arm',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic'],
    };

    const recipeSlot = {
      preferId: 'anatomy:preferred_arm',
      tags: ['tags:organic', 'tags:elite'],
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['arm'],
      recipeSlot,
      RNG_FIRST
    );

    expect(result).toBe('anatomy:preferred_arm');
    expect(testBed.eventDispatchService.safeDispatchEvent).not.toHaveBeenCalled();
  });

  it('falls back to candidates when preferred entity fails requirements', async () => {
    testBed.loadEntityDefinitions({
      'anatomy:preferred_leg': {
        id: 'anatomy:preferred_leg',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
          'tags:organic': {},
        },
      },
      'anatomy:standard_arm': {
        id: 'anatomy:standard_arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
        },
      },
    });

    const requirements = {
      partType: 'arm',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic'],
    };

    const recipeSlot = {
      preferId: 'anatomy:preferred_leg',
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['arm'],
      recipeSlot,
      RNG_FIRST
    );

    expect(result).toBe('anatomy:standard_arm');
  });

  it('applies tag, notTag, and property filters from recipe slots alongside requirements properties', async () => {
    testBed.loadEntityDefinitions({
      'anatomy:arm_missing_tag': {
        id: 'anatomy:arm_missing_tag',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:elite': {},
        },
      },
      'anatomy:arm_excluded': {
        id: 'anatomy:arm_excluded',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
          'tags:injured': {},
          'descriptors:material': { type: 'bone' },
        },
      },
      'anatomy:arm_valid': {
        id: 'anatomy:arm_valid',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
          'descriptors:length_arm': { length: 'long' },
          'descriptors:material': { type: 'bone' },
        },
      },
      'anatomy:arm_wrong_material': {
        id: 'anatomy:arm_wrong_material',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
          'descriptors:length_arm': { length: 'long' },
          'descriptors:material': { type: 'metal' },
        },
      },
    });

    const requirements = {
      partType: 'arm',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic'],
      properties: {
        'descriptors:material': { type: 'bone' },
      },
    };

    const recipeSlot = {
      tags: ['tags:organic'],
      notTags: ['tags:injured'],
      properties: {
        'descriptors:length_arm': { length: 'long' },
      },
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['arm'],
      recipeSlot,
      RNG_FIRST
    );

    expect(result).toBe('anatomy:arm_valid');
  });

  it('dispatches a validation error event with context when no candidates match', async () => {
    testBed.loadEntityDefinitions({
      'anatomy:arm_mismatch': {
        id: 'anatomy:arm_mismatch',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'tags:organic': {},
          'descriptors:length_arm': { length: 'short' },
        },
      },
    });

    const requirements = {
      partType: 'arm',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic'],
      properties: {
        'descriptors:material': { type: 'bone' },
      },
    };

    const recipeSlot = {
      tags: ['tags:organic'],
      notTags: ['tags:injured'],
      properties: {
        'descriptors:length_arm': { length: 'long' },
      },
    };

    await expect(
      testBed.partSelectionService.selectPart(
        requirements,
        ['arm'],
        recipeSlot,
        RNG_FIRST
      )
    ).rejects.toThrow(ValidationError);

    expect(testBed.eventDispatchService.safeDispatchEvent).toHaveBeenCalledTimes(1);
    const [eventId, payload] =
      testBed.eventDispatchService.safeDispatchEvent.mock.calls[0];
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('No entity definitions found matching anatomy requirements.'),
        details: expect.objectContaining({
          raw: expect.any(String),
        }),
      })
    );

    const context = JSON.parse(payload.details.raw);
    expect(context.allowedTypes).toEqual(['arm']);
    expect(context.recipeRequirements.tags).toEqual(['tags:organic']);
    expect(context.suggestion).toContain("components: [anatomy:part, tags:organic]");
  });
});
