import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';
import { ComponentExistenceValidationRule } from '../../../../src/anatomy/validation/rules/componentExistenceValidationRule.js';
import { PropertySchemaValidationRule } from '../../../../src/anatomy/validation/rules/propertySchemaValidationRule.js';
import ValidationPipeline from '../../../../src/anatomy/validation/core/ValidationPipeline.js';

const createValidatorStub = (name, { priority = 10, failFast = false } = {}) => {
  const validate = jest.fn(async () => ({
    errors: [],
    warnings: [],
    suggestions: [],
    passed: [{ check: name, message: `${name} ok` }],
  }));

  return {
    name,
    priority,
    failFast,
    validate,
  };
};

describe('RecipeValidationRunner', () => {
  let validator;
  let mockLogger;
  let mockDataRegistry;
  let mockAnatomyBlueprintRepository;
  let mockSchemaValidator;
  let mockSlotGenerator;
  let mockEntityMatcherService;
  let validatorStubs;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(() => undefined),
      getAll: jest.fn(() => []),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprint: jest.fn(async () => null),
      getRecipe: jest.fn(async () => null),
    };

    mockSchemaValidator = {
      validate: jest.fn(() => ({ isValid: true, errors: [] })),
    };

    mockSlotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(() => []),
      extractSlotKeysFromAppendage: jest.fn(() => []),
      generateBlueprintSlots: jest.fn(() => ({})),
    };

    mockEntityMatcherService = {
      findMatchingEntities: jest.fn(() => []),
      findMatchingEntitiesForSlot: jest.fn(() => []),
      mergePropertyRequirements: jest.fn(() => ({})),
    };

    validatorStubs = {
      blueprintExistence: createValidatorStub('blueprint-existence'),
      recipeBodyDescriptor: createValidatorStub('body-descriptors', {
        priority: 15,
      }),
      socketSlotCompatibility: createValidatorStub('socket-slot-compatibility', {
        priority: 20,
      }),
      partAvailability: createValidatorStub('part-availability', {
        priority: 25,
      }),
      generatedSlotParts: createValidatorStub('generated-slot-parts', {
        priority: 30,
      }),
      patternMatching: createValidatorStub('pattern-matching', {
        priority: 35,
      }),
      descriptorCoverage: createValidatorStub('descriptor-coverage', {
        priority: 40,
      }),
      loadFailure: createValidatorStub('load-failures', {
        priority: 50,
      }),
      recipeUsage: createValidatorStub('recipe-usage', {
        priority: 60,
      }),
    };

    validator = new RecipeValidationRunner({
      dataRegistry: mockDataRegistry,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      schemaValidator: mockSchemaValidator,
      slotGenerator: mockSlotGenerator,
      entityMatcherService: mockEntityMatcherService,
      logger: mockLogger,
      validators: validatorStubs,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createRecipe = () => ({
    recipeId: 'test:recipe',
    blueprintId: 'test:blueprint',
    slots: {},
    patterns: [],
  });

  const createDetailedRecipe = () => ({
    recipeId: 'test:detailed',
    blueprintId: 'test:blueprint',
    slots: {
      head: {
        tags: ['vision', 'focus'],
        properties: {
          accuracy: { value: 0.9 },
        },
      },
      arm: {
        tags: ['power'],
        properties: {
          strength: { rating: 5 },
          agility: { rating: 3 },
        },
      },
    },
    patterns: [
      {
        tags: ['pattern:stealth'],
        properties: {
          stealth: { required: true },
        },
      },
      {
        tags: ['pattern:combat', 'pattern:elite'],
        properties: {
          aggression: { level: 'high' },
          style: { type: 'dual' },
        },
      },
    ],
  });

  describe('constructor', () => {
    it('validates dependencies', () => {
      expect(() => validator).not.toThrow();
    });

    it('throws when slot generator lacks required methods', () => {
      expect(
        () =>
          new RecipeValidationRunner({
            dataRegistry: mockDataRegistry,
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            schemaValidator: mockSchemaValidator,
            slotGenerator: {},
            entityMatcherService: mockEntityMatcherService,
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('validate', () => {
    it('runs component and property checks before validator pipeline', async () => {
      const componentSpy = jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      const propertySpy = jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe());

      expect(componentSpy).toHaveBeenCalledTimes(1);
      expect(propertySpy).toHaveBeenCalledTimes(1);
      expect(validatorStubs.blueprintExistence.validate).toHaveBeenCalled();
      expect(report).toBeInstanceOf(ValidationReport);
    });

    it('merges validator results into report', async () => {
      validatorStubs.patternMatching.validate.mockResolvedValue({
        errors: [],
        warnings: [{ type: 'WARN', message: 'warn', severity: 'warning' }],
        suggestions: [{ type: 'INFO', message: 'info' }],
        passed: [{ check: 'pattern_matching', message: 'ok' }],
      });

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe());

      expect(report.warnings).toHaveLength(1);
      expect(report.suggestions).toHaveLength(1);
      expect(report.passed.some((p) => p.check === 'pattern_matching')).toBe(
        true
      );
    });

    it('respects validator-level failFast', async () => {
      validatorStubs.blueprintExistence.failFast = true;
      validatorStubs.blueprintExistence.validate.mockResolvedValue({
        errors: [{ type: 'BLUEPRINT_NOT_FOUND', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      });

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe());

      expect(report.errors).toHaveLength(1);
      expect(validatorStubs.recipeBodyDescriptor.validate).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "ValidationPipeline: Validator 'blueprint-existence' halted execution due to failFast errors"
      );
    });

    it('honors options.failFast and stops after first error', async () => {
      validatorStubs.blueprintExistence.validate.mockResolvedValue({
        errors: [{ type: 'BLUEPRINT_NOT_FOUND', severity: 'error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      });

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe(), {
        failFast: true,
      });

      expect(report.errors).toHaveLength(1);
      expect(validatorStubs.recipeBodyDescriptor.validate).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "ValidationPipeline: Halting pipeline after 'blueprint-existence' due to failFast option"
      );
    });

    it('skips validators when corresponding options are set', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      await validator.validate(createRecipe(), {
        skipPatternValidation: true,
        skipDescriptorChecks: true,
        skipPartAvailabilityChecks: true,
        skipGeneratedSlotChecks: true,
        skipLoadFailureChecks: true,
        skipRecipeUsageCheck: true,
      });

      expect(validatorStubs.patternMatching.validate).not.toHaveBeenCalled();
      expect(validatorStubs.descriptorCoverage.validate).not.toHaveBeenCalled();
      expect(validatorStubs.partAvailability.validate).not.toHaveBeenCalled();
      expect(validatorStubs.generatedSlotParts.validate).not.toHaveBeenCalled();
      expect(validatorStubs.loadFailure.validate).not.toHaveBeenCalled();
      expect(validatorStubs.recipeUsage.validate).not.toHaveBeenCalled();
    });

    it('passes load failures through validator options', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const loadFailures = { entityDefinitions: { failures: [] } };

      await validator.validate(createRecipe(), { loadFailures });

      expect(validatorStubs.loadFailure.validate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ loadFailures })
      );
    });

    it('continues when validator throws but logs error', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      validatorStubs.patternMatching.validate.mockRejectedValue(
        new Error('boom')
      );

      const report = await validator.validate(createRecipe());

      expect(mockLogger.error).toHaveBeenCalledWith(
        "ValidationPipeline: Validator 'pattern-matching' threw an exception",
        expect.any(Error)
      );
      expect(report.errors.some((e) => e.type === 'VALIDATION_ERROR')).toBe(
        true
      );
    });

    it('records component existence errors when rule reports issues', async () => {
      const componentIssues = [
        {
          type: 'MISSING_COMPONENT',
          severity: 'error',
          message: 'Missing link',
        },
      ];

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue(componentIssues);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe());

      expect(report.errors).toEqual(expect.arrayContaining(componentIssues));
    });

    it('logs and records component existence failures when rule throws', async () => {
      const failure = new Error('component boom');

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockRejectedValue(failure);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const report = await validator.validate(createRecipe());

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Component existence check failed',
        failure
      );
      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'VALIDATION_ERROR',
            check: 'component_existence',
          }),
        ])
      );
    });

    it('records property schema errors when rule reports issues', async () => {
      const propertyIssues = [
        {
          type: 'INVALID_PROPERTY_SCHEMA',
          severity: 'error',
          message: 'Invalid property',
        },
      ];

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue(propertyIssues);

      const report = await validator.validate(createRecipe());

      expect(report.errors).toEqual(expect.arrayContaining(propertyIssues));
    });

    it('logs and records property schema failures when rule throws', async () => {
      const failure = new Error('property boom');

      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockRejectedValue(failure);

      const report = await validator.validate(createRecipe());

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Property schema check failed',
        failure
      );
      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'VALIDATION_ERROR',
            check: 'property_schemas',
          }),
        ])
      );
    });

    it('returns early when validator pipeline produces no result', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const pipelineSpy = jest
        .spyOn(ValidationPipeline.prototype, 'execute')
        .mockResolvedValue(undefined);

      const report = await validator.validate(createRecipe());

      expect(pipelineSpy).toHaveBeenCalled();
      expect(report.errors).toHaveLength(0);
      expect(report.passed.some((entry) => entry.check === 'component_existence')).toBe(
        true
      );
    });

    it('reports accurate counts for component references and property objects', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      const detailedRecipe = createDetailedRecipe();
      const report = await validator.validate(detailedRecipe);

      const componentMessage = report.passed.find(
        (entry) => entry.check === 'component_existence'
      );
      const propertyMessage = report.passed.find(
        (entry) => entry.check === 'property_schemas'
      );

      expect(componentMessage.message).toBe(
        'All 12 component references exist'
      );
      expect(propertyMessage.message).toBe('All 6 property objects valid');
    });
  });
});
