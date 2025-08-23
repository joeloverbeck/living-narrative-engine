/**
 * @file Unit tests for Trait model
 * @see src/characterBuilder/models/trait.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Trait } from '../../../../src/characterBuilder/models/trait.js';

describe('Trait Model', () => {
  let validTraitData;

  beforeEach(() => {
    validTraitData = {
      names: [
        {
          name: 'Alexander',
          justification: 'Strong, classic name meaning defender',
        },
        { name: 'Kai', justification: 'Modern, simple name meaning ocean' },
        { name: 'Marcus', justification: 'Roman name suggesting strength' },
      ],
      physicalDescription:
        'A tall, athletic figure with piercing green eyes and dark hair that falls just past their shoulders. Their hands are calloused from years of training, and a small scar runs across their left cheek.',
      personality: [
        {
          trait: 'Determined',
          explanation:
            'Never gives up on important goals, even when facing overwhelming odds',
        },
        {
          trait: 'Compassionate',
          explanation:
            'Always puts others needs before their own, sometimes to a fault',
        },
        {
          trait: 'Quick-witted',
          explanation:
            'Thinks fast on their feet and can come up with creative solutions under pressure',
        },
      ],
      strengths: [
        'Combat skills',
        'Leadership abilities',
        'Strategic thinking',
      ],
      weaknesses: ['Impulsive decisions', 'Trusts too easily'],
      likes: [
        'Training at dawn',
        'Reading ancient texts',
        'Helping others',
        'Quiet moments in nature',
      ],
      dislikes: [
        'Injustice',
        'Dishonesty',
        'Unnecessary violence',
        'Being idle',
      ],
      fears: ['Failing to protect loved ones'],
      goals: {
        shortTerm: ['Master the advanced combat techniques'],
        longTerm:
          'Become a legendary protector and establish a school for training future guardians',
      },
      notes: [
        'Has a habit of humming when concentrating',
        'Prefers vegetarian meals',
      ],
      profile:
        'A noble warrior with a strong moral compass, dedicated to protecting the innocent and upholding justice. Their past experiences have shaped them into a formidable fighter, but their true strength lies in their unwavering compassion and ability to inspire others.',
      secrets: ['Secretly fears they inherited their fathers dark tendencies'],
    };
  });

  describe('Constructor', () => {
    it('should create valid trait with all fields', () => {
      const trait = new Trait(validTraitData);

      expect(trait.names).toEqual(validTraitData.names);
      expect(trait.physicalDescription).toBe(
        validTraitData.physicalDescription
      );
      expect(trait.personality).toEqual(validTraitData.personality);
      expect(trait.strengths).toEqual(validTraitData.strengths);
      expect(trait.weaknesses).toEqual(validTraitData.weaknesses);
      expect(trait.likes).toEqual(validTraitData.likes);
      expect(trait.dislikes).toEqual(validTraitData.dislikes);
      expect(trait.fears).toEqual(validTraitData.fears);
      expect(trait.goals).toEqual(validTraitData.goals);
      expect(trait.notes).toEqual(validTraitData.notes);
      expect(trait.profile).toBe(validTraitData.profile);
      expect(trait.secrets).toEqual(validTraitData.secrets);
      expect(trait.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('should generate UUID if id not provided', () => {
      const trait = new Trait(validTraitData);
      expect(trait.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should use provided id if given', () => {
      validTraitData.id = 'custom-trait-123';
      const trait = new Trait(validTraitData);
      expect(trait.id).toBe('custom-trait-123');
    });

    it('should generate generatedAt timestamp if not provided', () => {
      const trait = new Trait(validTraitData);
      expect(trait.generatedAt).toBeTruthy();
      expect(new Date(trait.generatedAt)).toBeInstanceOf(Date);
    });

    it('should use provided generatedAt if given', () => {
      const timestamp = '2024-01-01T00:00:00.000Z';
      validTraitData.generatedAt = timestamp;
      const trait = new Trait(validTraitData);
      expect(trait.generatedAt).toBe(timestamp);
    });

    it('should set empty metadata if not provided', () => {
      const trait = new Trait(validTraitData);
      expect(trait.metadata).toEqual({});
    });

    it('should use provided metadata if given', () => {
      const metadata = {
        model: 'gpt-4',
        temperature: 0.7,
        tokens: 500,
      };
      validTraitData.metadata = metadata;
      const trait = new Trait(validTraitData);
      expect(trait.metadata).toEqual(metadata);
    });

    it('should trim whitespace from text fields', () => {
      validTraitData.physicalDescription = '  A tall person  ';
      validTraitData.profile = '  A noble warrior  ';

      const trait = new Trait(validTraitData);

      expect(trait.physicalDescription).toBe('A tall person');
      expect(trait.profile).toBe('A noble warrior');
    });

    it('should handle empty data by providing defaults', () => {
      const trait = new Trait({});

      expect(Array.isArray(trait.names)).toBe(true);
      expect(trait.names).toEqual([]);
      expect(trait.physicalDescription).toBe('');
      expect(Array.isArray(trait.personality)).toBe(true);
      expect(trait.personality).toEqual([]);
      expect(Array.isArray(trait.strengths)).toBe(true);
      expect(trait.strengths).toEqual([]);
      expect(Array.isArray(trait.weaknesses)).toBe(true);
      expect(trait.weaknesses).toEqual([]);
      expect(Array.isArray(trait.likes)).toBe(true);
      expect(trait.likes).toEqual([]);
      expect(Array.isArray(trait.dislikes)).toBe(true);
      expect(trait.dislikes).toEqual([]);
      expect(Array.isArray(trait.fears)).toBe(true);
      expect(trait.fears).toEqual([]);
      expect(typeof trait.goals).toBe('object');
      expect(trait.goals.shortTerm).toEqual([]);
      expect(trait.goals.longTerm).toBe('');
      expect(Array.isArray(trait.notes)).toBe(true);
      expect(trait.notes).toEqual([]);
      expect(trait.profile).toBe('');
      expect(Array.isArray(trait.secrets)).toBe(true);
      expect(trait.secrets).toEqual([]);
    });

    it('should validate required fields', () => {
      expect(() => new Trait()).toThrow('Trait data is required');
      expect(() => new Trait(null)).toThrow('Trait data is required');
      expect(() => new Trait('invalid')).toThrow(
        'Trait data must be an object'
      );
    });

    it('should freeze the trait object', () => {
      const trait = new Trait(validTraitData);
      expect(Object.isFrozen(trait)).toBe(true);
      expect(Object.isFrozen(trait.names)).toBe(true);
      expect(Object.isFrozen(trait.personality)).toBe(true);
      expect(Object.isFrozen(trait.goals)).toBe(true);
      expect(Object.isFrozen(trait.metadata)).toBe(true);
    });
  });

  describe('fromLLMResponse', () => {
    let mockLLMResponse;

    beforeEach(() => {
      mockLLMResponse = {
        names: validTraitData.names,
        physicalDescription: validTraitData.physicalDescription,
        personality: validTraitData.personality,
        strengths: validTraitData.strengths,
        weaknesses: validTraitData.weaknesses,
        likes: validTraitData.likes,
        dislikes: validTraitData.dislikes,
        fears: validTraitData.fears,
        goals: validTraitData.goals,
        notes: validTraitData.notes,
        profile: validTraitData.profile,
        secrets: validTraitData.secrets,
      };
    });

    it('should create trait from LLM response', () => {
      const metadata = { model: 'gpt-4', temperature: 0.7 };
      const trait = Trait.fromLLMResponse(mockLLMResponse, metadata);

      expect(trait.names).toEqual(validTraitData.names);
      expect(trait.physicalDescription).toBe(
        validTraitData.physicalDescription
      );
      expect(trait.personality).toEqual(validTraitData.personality);
      expect(trait.strengths).toEqual(validTraitData.strengths);
      expect(trait.weaknesses).toEqual(validTraitData.weaknesses);
      expect(trait.likes).toEqual(validTraitData.likes);
      expect(trait.dislikes).toEqual(validTraitData.dislikes);
      expect(trait.fears).toEqual(validTraitData.fears);
      expect(trait.goals).toEqual(validTraitData.goals);
      expect(trait.notes).toEqual(validTraitData.notes);
      expect(trait.profile).toBe(validTraitData.profile);
      expect(trait.secrets).toEqual(validTraitData.secrets);
      expect(trait.metadata).toEqual(metadata);
    });

    it('should handle alternative field names', () => {
      const altResponse = {
        names: validTraitData.names,
        physical: validTraitData.physicalDescription, // alternative field name
        personality: validTraitData.personality,
        strengths: validTraitData.strengths,
        weaknesses: validTraitData.weaknesses,
        likes: validTraitData.likes,
        dislikes: validTraitData.dislikes,
        fears: validTraitData.fears,
        goals: validTraitData.goals,
        notes: validTraitData.notes,
        summary: validTraitData.profile, // alternative field name
        secrets: validTraitData.secrets,
      };

      const trait = Trait.fromLLMResponse(altResponse);
      expect(trait.physicalDescription).toBe(
        validTraitData.physicalDescription
      );
      expect(trait.profile).toBe(validTraitData.profile);
    });

    it('should handle missing fields with empty defaults', () => {
      const trait = Trait.fromLLMResponse({});

      expect(trait.names).toEqual([]);
      expect(trait.physicalDescription).toBe('');
      expect(trait.personality).toEqual([]);
      expect(trait.strengths).toEqual([]);
      expect(trait.weaknesses).toEqual([]);
      expect(trait.likes).toEqual([]);
      expect(trait.dislikes).toEqual([]);
      expect(trait.fears).toEqual([]);
      expect(trait.goals).toEqual({ shortTerm: [], longTerm: '' });
      expect(trait.notes).toEqual([]);
      expect(trait.profile).toBe('');
      expect(trait.secrets).toEqual([]);
    });

    it('should throw error for invalid input', () => {
      expect(() => Trait.fromLLMResponse(null)).toThrow(
        'Raw traits data is required and must be an object'
      );
      expect(() => Trait.fromLLMResponse(undefined)).toThrow(
        'Raw traits data is required and must be an object'
      );
      expect(() => Trait.fromLLMResponse('invalid')).toThrow(
        'Raw traits data is required and must be an object'
      );
    });
  });

  describe('fromRawData', () => {
    it('should create trait from raw data', () => {
      const trait = Trait.fromRawData(validTraitData);
      expect(trait.names).toEqual(validTraitData.names);
      expect(trait.physicalDescription).toBe(
        validTraitData.physicalDescription
      );
      expect(trait.profile).toBe(validTraitData.profile);
    });
  });

  describe('toJSON', () => {
    it('should serialize trait to plain object', () => {
      const trait = new Trait(validTraitData);
      const json = trait.toJSON();

      expect(json.id).toBe(trait.id);
      expect(json.names).toEqual(validTraitData.names);
      expect(json.physicalDescription).toBe(validTraitData.physicalDescription);
      expect(json.personality).toEqual(validTraitData.personality);
      expect(json.strengths).toEqual(validTraitData.strengths);
      expect(json.weaknesses).toEqual(validTraitData.weaknesses);
      expect(json.likes).toEqual(validTraitData.likes);
      expect(json.dislikes).toEqual(validTraitData.dislikes);
      expect(json.fears).toEqual(validTraitData.fears);
      expect(json.goals).toEqual(validTraitData.goals);
      expect(json.notes).toEqual(validTraitData.notes);
      expect(json.profile).toBe(validTraitData.profile);
      expect(json.secrets).toEqual(validTraitData.secrets);
      expect(json.generatedAt).toBe(trait.generatedAt);
      expect(json.metadata).toEqual({});
    });

    it('should create new arrays/objects in JSON (not references)', () => {
      const trait = new Trait(validTraitData);
      const json = trait.toJSON();

      expect(json.names).not.toBe(trait.names);
      expect(json.goals).not.toBe(trait.goals);
      expect(json.goals.shortTerm).not.toBe(trait.goals.shortTerm);
      expect(json.metadata).not.toBe(trait.metadata);
    });
  });

  describe('validate', () => {
    it('should return valid for complete valid trait', () => {
      const trait = new Trait(validTraitData);
      const result = trait.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    describe('names validation', () => {
      it('should require names array with 3-5 items', () => {
        const trait = new Trait({ ...validTraitData, names: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Names must be an array with 3-5 items'
        );
      });

      it('should validate name object structure', () => {
        const trait = new Trait({
          ...validTraitData,
          names: [
            { name: 'Test' }, // missing justification
            { name: 'Test2', justification: 'test' },
            { name: 'Test3', justification: 'test' },
          ],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes('Names[0].justification is required')
          )
        ).toBe(true);
      });

      it('should validate name fields are non-empty strings', () => {
        const trait = new Trait({
          ...validTraitData,
          names: [
            { name: '', justification: 'test' },
            { name: 'Test2', justification: 'test' },
            { name: 'Test3', justification: 'test' },
          ],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.includes('Names[0].name is required'))
        ).toBe(true);
      });
    });

    describe('physicalDescription validation', () => {
      it('should require physical description', () => {
        const trait = new Trait({ ...validTraitData, physicalDescription: '' });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Physical description is required and must be a string'
        );
      });

      it('should require minimum 100 characters', () => {
        const trait = new Trait({
          ...validTraitData,
          physicalDescription: 'Short',
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Physical description is too short (min 100 characters)'
        );
      });

      it('should warn for very long descriptions', () => {
        const longDescription = 'A'.repeat(501);
        const trait = new Trait({
          ...validTraitData,
          physicalDescription: longDescription,
        });
        const result = trait.validate();
        expect(result.warnings).toContain(
          'Physical description is very long (max recommended 500 characters)'
        );
      });
    });

    describe('personality validation', () => {
      it('should require personality array with 3-5 items', () => {
        const trait = new Trait({ ...validTraitData, personality: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Personality must be an array with 3-5 items'
        );
      });

      it('should validate personality object structure', () => {
        const trait = new Trait({
          ...validTraitData,
          personality: [
            { trait: 'Test' }, // missing explanation
            { trait: 'Test2', explanation: 'test' },
            { trait: 'Test3', explanation: 'test' },
          ],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes('Personality[0].explanation is required')
          )
        ).toBe(true);
      });
    });

    describe('strengths validation', () => {
      it('should require strengths array with 2-4 items', () => {
        const trait = new Trait({ ...validTraitData, strengths: ['Only one'] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Strengths must be an array with 2-4 items'
        );
      });

      it('should validate strength items are non-empty strings', () => {
        const trait = new Trait({
          ...validTraitData,
          strengths: ['Valid', ''],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) =>
            e.includes('Strengths[1] must be a non-empty string')
          )
        ).toBe(true);
      });
    });

    describe('weaknesses validation', () => {
      it('should require weaknesses array with 2-4 items', () => {
        const trait = new Trait({ ...validTraitData, weaknesses: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Weaknesses must be an array with 2-4 items'
        );
      });
    });

    describe('likes validation', () => {
      it('should require likes array with 3-5 items', () => {
        const trait = new Trait({ ...validTraitData, likes: ['Only', 'Two'] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Likes must be an array with 3-5 items'
        );
      });
    });

    describe('dislikes validation', () => {
      it('should require dislikes array with 3-5 items', () => {
        const trait = new Trait({ ...validTraitData, dislikes: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Dislikes must be an array with 3-5 items'
        );
      });
    });

    describe('fears validation', () => {
      it('should require fears array with 1-2 items', () => {
        const trait = new Trait({ ...validTraitData, fears: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Fears must be an array with 1-2 items'
        );
      });

      it('should reject too many fears', () => {
        const trait = new Trait({
          ...validTraitData,
          fears: ['Fear1', 'Fear2', 'Fear3'],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Fears must be an array with 1-2 items'
        );
      });
    });

    describe('goals validation', () => {
      it('should require goals object with shortTerm and longTerm', () => {
        const trait = new Trait({ ...validTraitData, goals: null });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Goals must be an object with shortTerm and longTerm properties'
        );
      });

      it('should validate shortTerm array with 1-2 items', () => {
        const trait = new Trait({
          ...validTraitData,
          goals: { shortTerm: [], longTerm: 'Test' },
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Goals.shortTerm must be an array with 1-2 items'
        );
      });

      it('should validate longTerm is non-empty string', () => {
        const trait = new Trait({
          ...validTraitData,
          goals: { shortTerm: ['Test'], longTerm: '' },
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Goals.longTerm is required and must be a non-empty string'
        );
      });
    });

    describe('notes validation', () => {
      it('should require notes array with 2-3 items', () => {
        const trait = new Trait({ ...validTraitData, notes: ['Only one'] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Notes must be an array with 2-3 items'
        );
      });
    });

    describe('profile validation', () => {
      it('should require profile', () => {
        const trait = new Trait({ ...validTraitData, profile: '' });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Profile is required and must be a string'
        );
      });

      it('should require minimum 200 characters', () => {
        const trait = new Trait({ ...validTraitData, profile: 'Short' });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Profile is too short (min 200 characters)'
        );
      });

      it('should warn for very long profiles', () => {
        const longProfile = 'A'.repeat(801);
        const trait = new Trait({ ...validTraitData, profile: longProfile });
        const result = trait.validate();
        expect(result.warnings).toContain(
          'Profile is very long (max recommended 800 characters)'
        );
      });
    });

    describe('secrets validation', () => {
      it('should require secrets array with 1-2 items', () => {
        const trait = new Trait({ ...validTraitData, secrets: [] });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Secrets must be an array with 1-2 items'
        );
      });

      it('should reject too many secrets', () => {
        const trait = new Trait({
          ...validTraitData,
          secrets: ['Secret1', 'Secret2', 'Secret3'],
        });
        const result = trait.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Secrets must be an array with 1-2 items'
        );
      });
    });
  });

  describe('toExportText', () => {
    it('should format trait for export', () => {
      const trait = new Trait(validTraitData);
      const exportText = trait.toExportText();

      expect(exportText).toContain('CHARACTER NAMES:');
      expect(exportText).toContain('1. Alexander');
      expect(exportText).toContain(
        'Justification: Strong, classic name meaning defender'
      );
      expect(exportText).toContain('PHYSICAL DESCRIPTION:');
      expect(exportText).toContain('PERSONALITY TRAITS:');
      expect(exportText).toContain('STRENGTHS:');
      expect(exportText).toContain('WEAKNESSES:');
      expect(exportText).toContain('LIKES:');
      expect(exportText).toContain('DISLIKES:');
      expect(exportText).toContain('FEARS:');
      expect(exportText).toContain('GOALS:');
      expect(exportText).toContain('Short-term:');
      expect(exportText).toContain('Long-term:');
      expect(exportText).toContain('ADDITIONAL NOTES:');
      expect(exportText).toContain('CHARACTER PROFILE:');
      expect(exportText).toContain('SECRETS:');
    });

    it('should handle empty arrays gracefully', () => {
      const emptyTrait = new Trait({});
      const exportText = emptyTrait.toExportText();

      expect(exportText).toContain('CHARACTER NAMES:');
      expect(exportText).toContain('PHYSICAL DESCRIPTION:');
      // Should not crash with empty arrays
      expect(typeof exportText).toBe('string');
    });
  });

  describe('getSummary', () => {
    it('should create summary with truncated fields', () => {
      const trait = new Trait(validTraitData);
      const summary = trait.getSummary(50);

      expect(summary.physicalDescription.length).toBeLessThanOrEqual(50);
      expect(summary.profile.length).toBeLessThanOrEqual(50);
      expect(summary.names).toContain('Alexander');
      expect(summary.personalityCount).toBe(3);
      expect(summary.strengthsCount).toBe(3);
      expect(summary.weaknessesCount).toBe(2);
    });

    it('should use default max length of 100', () => {
      const trait = new Trait(validTraitData);
      const summary = trait.getSummary();

      expect(summary.physicalDescription.length).toBeLessThanOrEqual(100);
      expect(summary.profile.length).toBeLessThanOrEqual(100);
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const trait = new Trait(validTraitData);
      const cloned = trait.clone();

      expect(cloned).not.toBe(trait);
      expect(cloned.id).toBe(trait.id);
      expect(cloned.names).toEqual(trait.names);
      expect(cloned.names).not.toBe(trait.names);
      expect(cloned.profile).toBe(trait.profile);
    });
  });

  describe('matchesSearch', () => {
    let trait;

    beforeEach(() => {
      trait = new Trait(validTraitData);
    });

    it('should match search terms in physical description', () => {
      expect(trait.matchesSearch('green eyes')).toBe(true);
      expect(trait.matchesSearch('athletic')).toBe(true);
    });

    it('should match search terms in profile', () => {
      expect(trait.matchesSearch('warrior')).toBe(true);
      expect(trait.matchesSearch('justice')).toBe(true);
    });

    it('should match search terms in names', () => {
      expect(trait.matchesSearch('Alexander')).toBe(true);
      expect(trait.matchesSearch('classic')).toBe(true); // from justification
    });

    it('should match search terms in personality', () => {
      expect(trait.matchesSearch('Determined')).toBe(true);
      expect(trait.matchesSearch('overwhelming odds')).toBe(true); // from explanation
    });

    it('should match search terms in array fields', () => {
      expect(trait.matchesSearch('Combat skills')).toBe(true); // strengths
      expect(trait.matchesSearch('Impulsive')).toBe(true); // weaknesses
      expect(trait.matchesSearch('Training')).toBe(true); // likes
      expect(trait.matchesSearch('Injustice')).toBe(true); // dislikes
      expect(trait.matchesSearch('protect')).toBe(true); // fears
      expect(trait.matchesSearch('Master')).toBe(true); // goals shortTerm
      expect(trait.matchesSearch('legendary')).toBe(true); // goals longTerm
      expect(trait.matchesSearch('humming')).toBe(true); // notes
      expect(trait.matchesSearch('dark tendencies')).toBe(true); // secrets
    });

    it('should be case insensitive', () => {
      expect(trait.matchesSearch('ALEXANDER')).toBe(true);
      expect(trait.matchesSearch('warrior')).toBe(true);
      expect(trait.matchesSearch('COMBAT')).toBe(true);
    });

    it('should return false for non-matching terms', () => {
      expect(trait.matchesSearch('nonexistent')).toBe(false);
      expect(trait.matchesSearch('xyz123')).toBe(false);
    });
  });
});
