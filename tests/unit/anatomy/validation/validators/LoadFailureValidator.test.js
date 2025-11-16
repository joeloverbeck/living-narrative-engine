import { describe, it, expect, beforeEach } from '@jest/globals';
import { LoadFailureValidator } from '../../../../../src/anatomy/validation/validators/LoadFailureValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (recipeId = 'core:test_recipe') => ({
  recipeId,
});

const buildFailureEntry = ({ file = 'core:entity.entity.json', error }) => ({
  file,
  error,
});

describe('LoadFailureValidator', () => {
  let logger;

  beforeEach(() => {
    ({ mockLogger: logger } = createTestBed());
  });

  const createValidator = () => new LoadFailureValidator({ logger });

  describe('constructor', () => {
    it('initializes with expected defaults', () => {
      const validator = createValidator();

      expect(validator.name).toBe('load-failures');
      expect(validator.priority).toBe(50);
      expect(validator.failFast).toBe(false);
    });

    it('throws when logger is missing', () => {
      expect(() => new LoadFailureValidator({ logger: null })).toThrow(
        'Missing required dependency: ILogger.'
      );
    });
  });

  describe('performValidation', () => {
    it('returns early when load failures are absent', async () => {
      const validator = createValidator();
      const recipe = createRecipe();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('ignores non-array failure payloads', async () => {
      const validator = createValidator();
      const recipe = createRecipe();

      const result = await validator.validate(recipe, {
        loadFailures: { entityDefinitions: { failures: {} } },
      });

      expect(result.errors).toHaveLength(0);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('reports component validation failures with detailed fixes', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const error = new Error(
        'Invalid components: [anatomy:body]\nValidation failed: data/size must be equal to one of the allowed values'
      );

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [buildFailureEntry({ error })],
          },
        },
      });

      expect(result.errors).toHaveLength(1);
      const issue = result.errors[0];
      expect(issue.message).toBe(
        "Entity definition 'core:entity' failed to load due to component validation errors"
      );
      expect(issue.details.failedComponents).toEqual(['anatomy:body']);
      expect(issue.details.validationDetails).toEqual([
        {
          component: 'anatomy:body',
          issue:
            "Property 'size' has an invalid value. Check allowed enum values in the component schema.",
        },
      ]);
      expect(issue.fix).toContain('Fix validation errors:');
      expect(logger.debug).toHaveBeenCalledWith(
        'LoadFailureValidator: Found 1 entity definition load failures'
      );
    });

    it('falls back to generic error output when no components are listed', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const error = new Error('Unable to parse entity definition');

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [buildFailureEntry({ error })],
          },
        },
      });

      expect(result.errors).toHaveLength(1);
      const issue = result.errors[0];
      expect(issue.message).toBe("Entity definition 'core:entity' failed to load");
      expect(issue.details).toEqual({
        file: 'core:entity.entity.json',
        error: 'Unable to parse entity definition',
      });
      expect(issue.fix).toBe(
        'Review core:entity.entity.json for validation errors'
      );
    });

    it('handles failed component parsing without enum details', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const error = new Error('Invalid components: [anatomy:body]\nGeneral failure');

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [buildFailureEntry({ error })],
          },
        },
      });

      const issue = result.errors[0];
      expect(issue.details.validationDetails).toEqual([
        {
          component: 'anatomy:body',
          issue: 'Component validation failed. Check schema requirements.',
        },
      ]);
      expect(issue.fix).toContain('Fix validation errors:');
    });

    it('falls back to component hint when component list cannot be parsed', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const error = new Error('Invalid components: []\nGeneral failure');

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [buildFailureEntry({ error })],
          },
        },
      });

      const issue = result.errors[0];
      expect(issue.details.failedComponents).toEqual([]);
      expect(issue.details.validationDetails).toEqual([]);
      expect(issue.fix).toContain('unknown components');
    });

    it('uses recipeId as fallback when file path is missing', async () => {
      const validator = createValidator();
      const recipe = createRecipe('core:backup');
      const error = new Error('Invalid components: [anatomy:body]');

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [{ file: undefined, error }],
          },
        },
      });

      expect(result.errors[0].message).toBe(
        "Entity definition 'core:backup' failed to load due to component validation errors"
      );
    });

    it('converts unknown error payloads to strings', async () => {
      const validator = createValidator();
      const recipe = createRecipe();

      const result = await validator.validate(recipe, {
        loadFailures: {
          entityDefinitions: {
            failures: [buildFailureEntry({ error: { not: 'an error' } })],
          },
        },
      });

      expect(result.errors[0].details.error).toBe('[object Object]');
    });

    it('processes large failure arrays', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const failures = Array.from({ length: 25 }).map((_, index) =>
        buildFailureEntry({
          file: `core:entity_${index}.entity.json`,
          error: new Error('General failure'),
        })
      );

      const result = await validator.validate(recipe, {
        loadFailures: { entityDefinitions: { failures } },
      });

      expect(result.errors).toHaveLength(25);
    });

    it('logs and suppresses unexpected exceptions', async () => {
      const validator = createValidator();
      const recipe = createRecipe();
      const loadFailures = new Proxy(
        {},
        {
          get() {
            throw new Error('proxy failure');
          },
        }
      );

      const result = await validator.validate(recipe, { loadFailures });

      expect(logger.error).toHaveBeenCalledWith(
        'Load failure validation failed',
        expect.any(Error)
      );
      expect(result.errors).toHaveLength(0);
    });
  });
});
