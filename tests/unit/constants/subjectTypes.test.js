import { describe, it, expect } from '@jest/globals';
import {
  SUBJECT_TYPES,
  SUBJECT_TYPE_DESCRIPTIONS,
  SUBJECT_TYPE_ENUM_VALUES,
  DEFAULT_SUBJECT_TYPE,
  isValidSubjectType,
  getSubjectTypeDescription,
} from '../../../src/constants/subjectTypes.js';

describe('subjectTypes constants', () => {
  it('should expose stable subject type identifiers', () => {
    const expectedEntries = {
      CHARACTER: 'character',
      LOCATION: 'location',
      ITEM: 'item',
      CREATURE: 'creature',
      EVENT: 'event',
      CONCEPT: 'concept',
      RELATIONSHIP: 'relationship',
      ORGANIZATION: 'organization',
      QUEST: 'quest',
      SKILL: 'skill',
      EMOTION: 'emotion',
      PLAN: 'plan',
      TIMELINE: 'timeline',
      THEORY: 'theory',
      OBSERVATION: 'observation',
      KNOWLEDGE_STATE: 'knowledge_state',
      PSYCHOLOGICAL_STATE: 'psychological_state',
      OTHER: 'other',
    };

    expect(SUBJECT_TYPES).toEqual(expectedEntries);
  });

  it('should include all 18 subject types', () => {
    expect(Object.keys(SUBJECT_TYPES)).toHaveLength(18);
  });

  it('should include new temporal types', () => {
    expect(SUBJECT_TYPES.PLAN).toBe('plan');
    expect(SUBJECT_TYPES.TIMELINE).toBe('timeline');
  });

  it('should include new epistemic types', () => {
    expect(SUBJECT_TYPES.THEORY).toBe('theory');
    expect(SUBJECT_TYPES.OBSERVATION).toBe('observation');
    expect(SUBJECT_TYPES.KNOWLEDGE_STATE).toBe('knowledge_state');
  });

  it('should include new psychological type', () => {
    expect(SUBJECT_TYPES.PSYCHOLOGICAL_STATE).toBe('psychological_state');
  });

  it('should provide human-readable descriptions for every subject type', () => {
    const typeKeys = Object.keys(SUBJECT_TYPES);

    typeKeys.forEach((key) => {
      const value = SUBJECT_TYPES[key];
      expect(SUBJECT_TYPE_DESCRIPTIONS).toHaveProperty(value);
      expect(typeof SUBJECT_TYPE_DESCRIPTIONS[value]).toBe('string');
      expect(SUBJECT_TYPE_DESCRIPTIONS[value].length).toBeGreaterThan(0);
    });

    // Ensure descriptions do not introduce extra unexpected keys
    const descriptionKeys = Object.keys(SUBJECT_TYPE_DESCRIPTIONS);
    expect(descriptionKeys.sort()).toEqual(
      typeKeys.map((key) => SUBJECT_TYPES[key]).sort(),
    );
  });

  it('should expose an enum values array containing every subject type value exactly once', () => {
    expect(SUBJECT_TYPE_ENUM_VALUES).toHaveLength(
      Object.keys(SUBJECT_TYPES).length,
    );
    // Unique check via Set size
    const uniqueValues = new Set(SUBJECT_TYPE_ENUM_VALUES);
    expect(uniqueValues.size).toBe(SUBJECT_TYPE_ENUM_VALUES.length);
    SUBJECT_TYPE_ENUM_VALUES.forEach((value) => {
      expect(Object.values(SUBJECT_TYPES)).toContain(value);
    });
  });

  it('should define OTHER as the default subject type', () => {
    expect(DEFAULT_SUBJECT_TYPE).toBe(SUBJECT_TYPES.OTHER);
  });

  it('should clearly distinguish temporal concepts', () => {
    expect(SUBJECT_TYPE_DESCRIPTIONS[SUBJECT_TYPES.EVENT]).toContain('Incidents');
    expect(SUBJECT_TYPE_DESCRIPTIONS[SUBJECT_TYPES.PLAN]).toContain('Future');
    expect(SUBJECT_TYPE_DESCRIPTIONS[SUBJECT_TYPES.TIMELINE]).toContain('Temporal');
  });
});

describe('subjectTypes helpers', () => {
  it('should confirm validity for every known subject type', () => {
    SUBJECT_TYPE_ENUM_VALUES.forEach((value) => {
      expect(isValidSubjectType(value)).toBe(true);
    });
  });

  it('should reject invalid or blank subject types', () => {
    const invalidValues = [undefined, null, '', 'Unknown', 'character ', 42];
    invalidValues.forEach((value) => {
      expect(isValidSubjectType(value)).toBe(false);
    });
  });

  it('should return the matching description for known subject types', () => {
    SUBJECT_TYPE_ENUM_VALUES.forEach((value) => {
      const description = getSubjectTypeDescription(value);
      expect(description).toBe(SUBJECT_TYPE_DESCRIPTIONS[value]);
    });
  });

  it('should fall back to a friendly message when description is unavailable', () => {
    expect(getSubjectTypeDescription('non-existent-type')).toBe(
      'Unknown subject type',
    );
  });
});
