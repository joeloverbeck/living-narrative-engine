/**
 * @file Integration test for mood_lexicon lookup loading.
 * @description Tests that the mood_lexicon lookup table is properly loaded
 * and accessible via the data registry.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Mood Lexicon Lookup - Loading', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
      fixture = null;
    }
  });

  describe('Lookup Availability', () => {
    it('should load mood_lexicon lookup from music mod', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      expect(lookup).toBeDefined();
      expect(lookup.id).toBe('music:mood_lexicon');
      expect(lookup.entries).toBeDefined();
      expect(typeof lookup.entries).toBe('object');
    });

    it('should contain all 10 mood entries', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const expectedMoods = [
        'cheerful',
        'solemn',
        'mournful',
        'eerie',
        'tense',
        'triumphant',
        'tender',
        'playful',
        'aggressive',
        'meditative',
      ];

      for (const mood of expectedMoods) {
        expect(lookup.entries[mood]).toBeDefined();
        expect(lookup.entries[mood]).toHaveProperty('adj');
        expect(lookup.entries[mood]).toHaveProperty('adjectives');
        expect(lookup.entries[mood]).toHaveProperty('noun');
      }
    });
  });

  describe('Entry Structure', () => {
    it('should have correct structure for cheerful entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const cheerful = lookup.entries.cheerful;

      expect(cheerful.adj).toBe('bright');
      expect(cheerful.adjectives).toBe('bright, skipping');
      expect(cheerful.noun).toBe('bouncy');
    });

    it('should have correct structure for solemn entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const solemn = lookup.entries.solemn;

      expect(solemn.adj).toBe('grave');
      expect(solemn.adjectives).toBe('measured, weighty');
      expect(solemn.noun).toBe('grave');
    });

    it('should have correct structure for mournful entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const mournful = lookup.entries.mournful;

      expect(mournful.adj).toBe('aching');
      expect(mournful.adjectives).toBe('low, aching');
      expect(mournful.noun).toBe('woeful');
    });

    it('should have correct structure for eerie entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const eerie = lookup.entries.eerie;

      expect(eerie.adj).toBe('unsettling');
      expect(eerie.adjectives).toBe('thin, uneasy');
      expect(eerie.noun).toBe('hollow');
    });

    it('should have correct structure for tense entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const tense = lookup.entries.tense;

      expect(tense.adj).toBe('tight');
      expect(tense.adjectives).toBe('insistent, tight');
      expect(tense.noun).toBe('tight');
    });

    it('should have correct structure for triumphant entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const triumphant = lookup.entries.triumphant;

      expect(triumphant.adj).toBe('bold');
      expect(triumphant.adjectives).toBe('ringing, bold');
      expect(triumphant.noun).toBe('bold');
    });

    it('should have correct structure for tender entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const tender = lookup.entries.tender;

      expect(tender.adj).toBe('soft');
      expect(tender.adjectives).toBe('soft, warm');
      expect(tender.noun).toBe('delicate');
    });

    it('should have correct structure for playful entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const playful = lookup.entries.playful;

      expect(playful.adj).toBe('teasing');
      expect(playful.adjectives).toBe('quick, teasing');
      expect(playful.noun).toBe('skipping');
    });

    it('should have correct structure for aggressive entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const aggressive = lookup.entries.aggressive;

      expect(aggressive.adj).toBe('hard-edged');
      expect(aggressive.adjectives).toBe('driving, sharp');
      expect(aggressive.noun).toBe('hard-driving');
    });

    it('should have correct structure for meditative entry', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const meditative = lookup.entries.meditative;

      expect(meditative.adj).toBe('calm');
      expect(meditative.adjectives).toBe('slow, even');
      expect(meditative.noun).toBe('steady');
    });
  });

  describe('Schema Compliance', () => {
    it('should have valid schema reference', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      expect(lookup.$schema).toBeDefined();
      expect(lookup.$schema).toContain('lookup.schema.json');
    });

    it('should have description field', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      expect(lookup.description).toBeDefined();
      expect(typeof lookup.description).toBe('string');
      expect(lookup.description.length).toBeGreaterThan(0);
    });

    it('should have dataSchema field', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      expect(lookup.dataSchema).toBeDefined();
      expect(lookup.dataSchema.type).toBe('object');
      expect(lookup.dataSchema.properties).toBeDefined();
      expect(lookup.dataSchema.properties.adj).toBeDefined();
      expect(lookup.dataSchema.properties.adjectives).toBeDefined();
      expect(lookup.dataSchema.properties.noun).toBeDefined();
    });
  });

  describe('Entry Count', () => {
    it('should have exactly 10 mood entries', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      const entryKeys = Object.keys(lookup.entries);
      expect(entryKeys.length).toBe(10);
    });

    it('should not have any undefined or null entries', async () => {
      fixture = await ModTestFixture.forCategory('music');

      const dataRegistry = fixture.getDataRegistry();
      const lookup = dataRegistry.get('lookups', 'music:mood_lexicon');

      for (const [key, value] of Object.entries(lookup.entries)) {
        expect(value).toBeDefined();
        expect(value).not.toBeNull();
        expect(typeof value).toBe('object');
      }
    });
  });
});
