import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_PART_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';

const RNG_FIRST = () => 0;

describe('PartSelectionService dependency validation', () => {
  let registry;
  let safeEventDispatcher;

  beforeEach(() => {
    registry = new InMemoryDataRegistry();
    safeEventDispatcher = { dispatch: jest.fn() };
  });

  it('requires a data registry dependency', () => {
    const logger = console;
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher,
      logger,
    });

    expect(
      () =>
        new PartSelectionService({
          logger,
          eventDispatchService,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('requires a logger dependency', () => {
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher,
      logger: console,
    });

    expect(
      () =>
        new PartSelectionService({
          dataRegistry: registry,
          eventDispatchService,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('requires an event dispatch service dependency', () => {
    expect(
      () =>
        new PartSelectionService({
          dataRegistry: registry,
          logger: console,
        })
    ).toThrow(InvalidArgumentError);
  });
});

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
    expect(
      testBed.eventDispatchService.safeDispatchEvent
    ).not.toHaveBeenCalled();
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

  it('logs diagnostic details for special anatomy definitions while filtering candidates', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    testBed.loadEntityDefinitions({
      'anatomy:tentacle': {
        id: 'anatomy:tentacle',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'tentacle' },
          'tags:organic': {},
          'tags:elite': {},
          'descriptors:length_arm': { length: 'long' },
          'descriptors:material': { type: 'bone' },
        },
      },
      'anatomy:mantle': {
        id: 'anatomy:mantle',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'mantle' },
          'descriptors:material': { type: 'bone' },
        },
      },
      'anatomy-creatures:dragon_wing': {
        id: 'anatomy-creatures:dragon_wing',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'wing' },
          'tags:organic': {},
          'descriptors:length_arm': { length: 'short' },
          'descriptors:material': { type: 'bone' },
        },
      },
      'anatomy:tentacle_wood': {
        id: 'anatomy:tentacle_wood',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'tentacle' },
          'tags:organic': {},
          'descriptors:length_arm': { length: 'long' },
          'descriptors:material': { type: 'wood' },
        },
      },
    });

    const requirements = {
      components: [ANATOMY_PART_COMPONENT_ID],
      properties: {
        'descriptors:material': { type: 'bone' },
      },
    };

    const recipeSlot = {
      tags: ['tags:organic'],
      properties: {
        'descriptors:length_arm': { length: 'long' },
      },
    };

    const result = await testBed.partSelectionService.selectPart(
      requirements,
      ['tentacle', 'mantle', 'wing'],
      recipeSlot,
      RNG_FIRST
    );

    const logMessages = consoleSpy.mock.calls.map((call) =>
      call
        .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
        .join(' ')
    );

    expect(result).toBe('anatomy:tentacle');
    expect(
      logMessages.some((message) =>
        message.includes('🔍 PartSelectionService: Checking anatomy:tentacle')
      )
    ).toBe(true);
    expect(
      logMessages.some((message) =>
        message.includes('✅ PartSelectionService: anatomy:tentacle PASSED')
      )
    ).toBe(true);
    expect(
      logMessages.some((message) =>
        message.includes('❌ PartSelectionService: anatomy:mantle FAILED')
      )
    ).toBe(true);
    expect(
      logMessages.some((message) =>
        message.includes('❌ anatomy:mantle FAILED - missing required tags')
      )
    ).toBe(true);
    expect(
      logMessages.some((message) =>
        message.includes(
          "❌ anatomy-creatures:dragon_wing FAILED - properties don't match recipe slot requirements"
        )
      )
    ).toBe(true);

    expect(testBed.logger.debug.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining(
            "Entity anatomy-creatures:dragon_wing filtered out - properties don't match recipe slot requirements"
          ),
          expect.objectContaining({ entityId: 'anatomy-creatures:dragon_wing' }),
        ],
        [
          expect.stringContaining(
            "Entity anatomy:tentacle_wood filtered out - properties don't match requirements"
          ),
          expect.objectContaining({ entityId: 'anatomy:tentacle_wood' }),
        ],
      ])
    );

    consoleSpy.mockRestore();
  });

  it('provides kraken-specific validation logs across failure and success paths', async () => {
    testBed.loadEntityDefinitions({
      'anatomy-creatures:kraken_head': {
        id: 'anatomy-creatures:kraken_head',
        components: {},
      },
      'anatomy-creatures:kraken_tentacle': {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {},
      },
      'anatomy:tentacle': {
        id: 'anatomy:tentacle',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'tentacle' },
          'tags:organic': {},
          'tags:elite': {},
        },
      },
    });

    const baseRequirements = {
      partType: 'tentacle',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic', 'tags:elite'],
    };
    const recipeSlot = { tags: ['tags:organic'] };

    await testBed.partSelectionService.selectPart(
      baseRequirements,
      ['tentacle', 'head'],
      recipeSlot,
      RNG_FIRST
    );

    expect(testBed.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining(
            'PartSelectionService: kraken_head FAILED - no anatomy:part component'
          ),
        ],
        [
          expect.stringContaining(
            'PartSelectionService: kraken_tentacle FAILED - no anatomy:part component'
          ),
        ],
      ])
    );

    testBed.logger.info.mockClear();

    testBed.loadEntityDefinitions({
      'anatomy-creatures:kraken_head': {
        id: 'anatomy-creatures:kraken_head',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
          'tags:organic': {},
        },
      },
      'anatomy-creatures:kraken_tentacle': {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'tentacle' },
          'tags:organic': {},
        },
      },
    });

    await testBed.partSelectionService.selectPart(
      baseRequirements,
      ['tentacle', 'head'],
      recipeSlot,
      RNG_FIRST
    );

    expect(testBed.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining(
            "PartSelectionService: kraken_head FAILED - subType 'head' !== required 'tentacle'"
          ),
        ],
        [
          expect.stringContaining(
            'PartSelectionService: kraken_tentacle FAILED - missing required components: [tags:elite]'
          ),
          expect.objectContaining({
            hasComponents: expect.arrayContaining([
              'anatomy:part',
              'tags:organic',
            ]),
          }),
        ],
      ])
    );

    testBed.logger.info.mockClear();

    testBed.loadEntityDefinitions({
      'anatomy-creatures:kraken_head': {
        id: 'anatomy-creatures:kraken_head',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
          'tags:organic': {},
          'tags:elite': {},
        },
      },
      'anatomy-creatures:kraken_tentacle': {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'tentacle' },
          'tags:organic': {},
          'tags:elite': {},
        },
      },
    });

    const headRequirements = {
      partType: 'head',
      components: [ANATOMY_PART_COMPONENT_ID, 'tags:organic', 'tags:elite'],
    };

    const headResult = await testBed.partSelectionService.selectPart(
      headRequirements,
      ['head', 'tentacle'],
      recipeSlot,
      RNG_FIRST
    );

    expect(headResult).toBe('anatomy-creatures:kraken_head');
    expect(testBed.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining(
            'PartSelectionService: kraken_head PASSED all validation checks'
          ),
        ],
        [
          expect.stringContaining(
            "PartSelectionService: kraken_tentacle FAILED - subType 'tentacle' !== required 'head'"
          ),
        ],
      ])
    );

    testBed.logger.info.mockClear();

    const tentacleResult = await testBed.partSelectionService.selectPart(
      baseRequirements,
      ['tentacle', 'head'],
      recipeSlot,
      RNG_FIRST
    );

    expect(tentacleResult).toBe('anatomy-creatures:kraken_tentacle');
    expect(testBed.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining(
            'PartSelectionService: kraken_tentacle PASSED all validation checks'
          ),
        ],
      ])
    );
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

    expect(
      testBed.eventDispatchService.safeDispatchEvent
    ).toHaveBeenCalledTimes(1);
    const [eventId, payload] =
      testBed.eventDispatchService.safeDispatchEvent.mock.calls[0];
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'No entity definitions found matching anatomy requirements.'
        ),
        details: expect.objectContaining({
          raw: expect.any(String),
        }),
      })
    );

    const context = JSON.parse(payload.details.raw);
    expect(context.allowedTypes).toEqual(['arm']);
    expect(context.recipeRequirements.tags).toEqual(['tags:organic']);
    expect(context.recipeRequirements.notTags).toEqual(['tags:injured']);
    expect(context.suggestion).toContain(
      'components: [anatomy:part, tags:organic]'
    );
    expect(context.suggestion).toContain('and tags: [tags:organic]');
  });
});
