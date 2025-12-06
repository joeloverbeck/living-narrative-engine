/**
 * @file Comprehensive unit tests for CharacterDefinitionValidator
 * @description Provides high coverage for complex validation flows, cache handling, and error scenarios.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterDefinitionValidator } from '../../../../src/characterBuilder/validators/CharacterDefinitionValidator.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createValidator = (logger = createLogger()) =>
  new CharacterDefinitionValidator({ logger });

const createDetailedCharacter = () => ({
  components: {
    'core:name': { text: 'Ava Winters' },
    'core:personality': {
      description:
        'A meticulous archivist who loves uncovering stories hidden in forgotten letters.',
    },
    'core:profile': {
      age: 33,
      occupation: 'Archivist',
      location: 'New Harbor',
      history:
        'Raised in a coastal town and now preserving local history with obsessive dedication.',
    },
    'core:goals': ['Uncover the truth behind the town legend.'],
    'core:fears': ['Losing the archive to neglect.'],
    'core:conflicts': ['The mayor wants to sell the archive to developers.'],
    'core:secrets': [
      'She secretly translated the letters to protect a friend.',
    ],
    'core:likes': ['Rainy afternoons spent cataloging.'],
    'core:dislikes': ['Careless handling of delicate documents.'],
    'core:strengths': ['Persistent and resourceful.'],
    'core:weaknesses': ['Reluctant to ask for help.'],
  },
});

describe('CharacterDefinitionValidator comprehensive behavior', () => {
  let logger;
  let validator;

  beforeEach(() => {
    logger = createLogger();
    validator = createValidator(logger);
  });

  afterEach(() => {
    validator.clearCache();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('converts semantic errors into warnings when custom rule returns blocking issues', async () => {
    validator.registerSemanticRule({
      id: 'test:semantic-error',
      name: 'Test Semantic Error',
      category: 'testing',
      priority: 10,
      validator: () => ({
        errors: ['Semantic failure: duplicate identifiers'],
      }),
    });

    const result = await validator.validateCharacterDefinition(
      createDetailedCharacter()
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      'Semantic failure: duplicate identifiers'
    );
    expect(result.context.layers.semantic.rulesApplied).toContain(
      'test:semantic-error'
    );
  });

  it('flags low quality scores with a warning', async () => {
    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': { text: 'Minimal Character' },
      },
    });

    expect(result.warnings).toContain(
      'Character definition may need more detail for optimal results'
    );
    expect(result.quality.overallScore).toBeLessThan(0.4);
  });

  it('captures fatal errors and returns structured failure responses', async () => {
    const failingLogger = createLogger();
    failingLogger.debug.mockImplementation((message) => {
      if (message === 'Character definition validation completed') {
        throw new Error('logger failure');
      }
    });

    const errorAwareValidator = createValidator(failingLogger);

    const result = await errorAwareValidator.validateCharacterDefinition(
      createDetailedCharacter()
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Validation system error: logger failure');
    expect(failingLogger.error).toHaveBeenCalledWith(
      'Character definition validation failed',
      expect.any(Error)
    );
  });

  it('reports structural issues for empty character names', async () => {
    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': { text: '   ' },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Character name cannot be empty');
  });

  it('flags personal name entries containing only whitespace', async () => {
    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': {
          personal: { firstName: '   ', lastName: '\t' },
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Character name cannot be empty');
  });

  it('extracts character names from multiple formats', () => {
    expect(validator.extractCharacterName(null)).toBeNull();
    expect(
      validator.extractCharacterName({
        components: { 'core:name': 'Direct string name' },
      })
    ).toBeNull();

    expect(
      validator.extractCharacterName({
        components: {
          'core:name': {
            personal: { firstName: 'Jamie', lastName: 'Rivera' },
          },
        },
      })
    ).toBe('Jamie Rivera');
  });

  it('returns null when character definition omits a name component', () => {
    expect(
      validator.extractCharacterName({
        components: { 'core:personality': { traits: ['curious'] } },
      })
    ).toBeNull();
  });

  it('extracts requested traits and safely handles invalid input', () => {
    expect(validator.extractTraits(null, ['core:likes'])).toEqual({});

    const traits = validator.extractTraits(
      {
        components: {
          'core:likes': ['mysteries'],
          'core:fears': ['failure'],
          'core:name': { text: 'Trait Hunter' },
        },
      },
      ['core:likes', 'core:fears', 'core:strengths']
    );

    expect(traits).toEqual({
      'core:likes': ['mysteries'],
      'core:fears': ['failure'],
    });
  });

  it('logs semantic rule failures and adds internal warning when rule throws', async () => {
    validator.registerSemanticRule({
      id: 'test:failing-rule',
      name: 'Failing Rule',
      category: 'testing',
      priority: 1,
      validator: () => {
        throw new Error('Rule failure');
      },
    });

    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': { text: 'Rule Failure' },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Semantic rule 'test:failing-rule' failed",
      expect.any(Error)
    );
    expect(result.warnings).toContain(
      'Internal validation warning: Failing Rule check encountered an issue'
    );
  });

  it('records metric failures when assessments throw errors', async () => {
    validator.registerQualityMetric({
      id: 'test:failing-metric',
      name: 'Failing Metric',
      weight: 0.1,
      assessor: () => {
        throw new Error('Metric failure');
      },
    });

    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': { text: 'Metric Failure' },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Quality metric 'test:failing-metric' failed",
      expect.any(Error)
    );
    expect(result.quality.breakdown['test:failing-metric'].level).toBe('error');
    expect(result.quality.breakdown['test:failing-metric'].details.error).toBe(
      'Metric failure'
    );
  });

  it('detects contradictory personality traits', async () => {
    const result = await validator.validateCharacterDefinition({
      components: {
        'core:name': { text: 'Dual Nature' },
        'core:personality': {
          summary: 'Simultaneously introverted and extroverted spirit.',
        },
      },
    });

    expect(result.warnings).toContain(
      'Potentially contradictory personality traits: introverted, extroverted'
    );
  });

  it('captures narrative potential metrics when conflicts are present', async () => {
    const result = await validator.validateCharacterDefinition(
      createDetailedCharacter()
    );

    const narrativeDetails =
      result.quality.breakdown.narrative_potential.details;
    expect(narrativeDetails.hasConflicts).toBe(true);
    expect(narrativeDetails.hasGoals).toBe(true);
  });

  it('expires cached validations after exceeding the TTL', async () => {
    jest.useFakeTimers({ now: Date.now() });

    const data = createDetailedCharacter();

    await validator.validateCharacterDefinition(data);

    logger.debug.mockClear();
    const cachedResult = await validator.validateCharacterDefinition(data);
    expect(logger.debug).toHaveBeenCalledWith(
      'Returning cached validation result'
    );

    logger.debug.mockClear();
    jest.advanceTimersByTime(600000 + 5);

    const refreshedResult = await validator.validateCharacterDefinition(data);
    const cacheHits = logger.debug.mock.calls.filter(
      ([message]) => message === 'Returning cached validation result'
    );

    expect(cacheHits).toHaveLength(0);
    expect(refreshedResult).not.toBe(cachedResult);
  });

  it('validates semantic rule registration inputs', () => {
    expect(() => validator.registerSemanticRule(null)).toThrow(
      'Semantic rule must be an object'
    );
    expect(() =>
      validator.registerSemanticRule({ id: 123, validator: () => ({}) })
    ).toThrow('Semantic rule must include an id');
    expect(() =>
      validator.registerSemanticRule({ id: 'missingValidator' })
    ).toThrow('Semantic rule must provide a validator function');

    expect(() => validator.registerQualityMetric(null)).toThrow(
      'Quality metric must be an object'
    );
    expect(() =>
      validator.registerQualityMetric({ id: 42, assessor: () => ({}) })
    ).toThrow('Quality metric must include an id');
    expect(() =>
      validator.registerQualityMetric({ id: 'missingAssessor' })
    ).toThrow('Quality metric must provide an assessor function');
    expect(() =>
      validator.registerQualityMetric({
        id: 'missingWeight',
        assessor: () => ({ score: 0 }),
      })
    ).toThrow('Quality metric must include a numeric weight');
  });
});
