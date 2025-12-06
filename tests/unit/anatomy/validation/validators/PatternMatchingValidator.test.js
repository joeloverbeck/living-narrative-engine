import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternMatchingValidator } from '../../../../../src/anatomy/validation/validators/PatternMatchingValidator.js';
import * as blueprintProcessingUtils from '../../../../../src/anatomy/validation/utils/blueprintProcessingUtils.js';

describe('PatternMatchingValidator', () => {
  let logger;
  let dataRegistry;
  let slotGenerator;
  let anatomyBlueprintRepository;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    dataRegistry = {
      get: jest.fn(),
    };
    slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest.fn(),
      generateBlueprintSlots: jest.fn(),
    };
    anatomyBlueprintRepository = {
      getBlueprint: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   *
   */
  function createValidator() {
    return new PatternMatchingValidator({
      logger,
      dataRegistry,
      slotGenerator,
      anatomyBlueprintRepository,
    });
  }

  it('validates required dependencies in constructor', () => {
    expect(
      () =>
        new PatternMatchingValidator({
          logger,
          dataRegistry: {},
          slotGenerator,
          anatomyBlueprintRepository,
        })
    ).toThrow('Invalid or missing method');
  });

  it('adds passed entry when recipe has no patterns', async () => {
    const validator = createValidator();
    const recipe = { recipeId: 'recipe:none', patterns: [] };

    const result = await validator.validate(recipe);

    expect(result.passed).toEqual([
      { message: 'No patterns to validate', check: 'pattern_matching' },
    ]);
  });

  it('skips validation when blueprint cannot be loaded', async () => {
    const validator = createValidator();
    anatomyBlueprintRepository.getBlueprint.mockResolvedValue(null);
    const recipe = {
      recipeId: 'recipe:missing',
      blueprintId: 'missing:blueprint',
      patterns: [{}],
    };

    const result = await validator.validate(recipe);

    expect(result.warnings).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      "PatternMatchingValidator: Blueprint 'missing:blueprint' not found, skipping pattern validation"
    );
  });

  it('records success when all patterns have matches', async () => {
    const validator = createValidator();
    const blueprint = {
      id: 'blueprint:test',
      _generatedSockets: true,
      slots: { leg_left: { socket: 'leg_left' } },
    };
    anatomyBlueprintRepository.getBlueprint.mockResolvedValue(blueprint);
    jest
      .spyOn(blueprintProcessingUtils, 'ensureBlueprintProcessed')
      .mockResolvedValue(blueprint);

    const recipe = {
      recipeId: 'recipe:success',
      blueprintId: 'blueprint:test',
      patterns: [{ matchesPattern: 'leg_*' }],
    };

    const result = await validator.validate(recipe);

    expect(result.passed).toEqual([
      {
        message: 'All 1 pattern(s) have matching slots',
        check: 'pattern_matching',
      },
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('adds warnings for zero-match patterns', async () => {
    const validator = createValidator();
    const processedBlueprint = {
      id: 'blueprint:test',
      _generatedSockets: true,
      slots: { leg_left: { socket: 'leg_left' } },
      structureTemplate: 'tpl',
    };
    anatomyBlueprintRepository.getBlueprint.mockResolvedValue(
      processedBlueprint
    );
    jest
      .spyOn(blueprintProcessingUtils, 'ensureBlueprintProcessed')
      .mockResolvedValue(processedBlueprint);

    const recipe = {
      recipeId: 'recipe:warnings',
      blueprintId: 'blueprint:test',
      patterns: [{ matchesPattern: 'wing_*' }, { matchesPattern: 'horn_*' }],
    };

    const result = await validator.validate(recipe);

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatchObject({
      type: 'NO_MATCHING_SLOTS',
      matcher: { type: 'matchesPattern', value: 'wing_*' },
      severity: 'warning',
    });
    expect(result.passed).toHaveLength(0);
  });

  it('adds validation warning when blueprint processing fails', async () => {
    const validator = createValidator();
    anatomyBlueprintRepository.getBlueprint.mockResolvedValue({
      id: 'blueprint:test',
      structureTemplate: 'tpl',
    });
    jest
      .spyOn(blueprintProcessingUtils, 'ensureBlueprintProcessed')
      .mockRejectedValue(new Error('processing failed'));

    const recipe = {
      recipeId: 'recipe:error',
      blueprintId: 'blueprint:test',
      patterns: [{ matchesPattern: 'leg_*' }],
    };

    const result = await validator.validate(recipe);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      type: 'VALIDATION_WARNING',
      message: 'Pattern matching check failed',
      check: 'pattern_matching',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'pattern-matching check failed',
      expect.any(Error)
    );
  });
});
