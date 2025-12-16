// tests/unit/prompting/helpers/darknessWorldContextBuilder.test.js

import { describe, it, expect } from '@jest/globals';
import { buildDarknessWorldContext } from '../../../../src/prompting/helpers/darknessWorldContextBuilder.js';
import { PRESENCE_MESSAGES } from '../../../../src/domUI/location/presenceMessageBuilder.js';

describe('darknessWorldContextBuilder', () => {
  describe('buildDarknessWorldContext', () => {
    describe('markdown structure', () => {
      it('should return correct markdown structure', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dark Cave',
          darknessDescription: null,
          characterCount: 0,
        });

        expect(result).toContain('## Current Situation');
        expect(result).toContain('### Location');
        expect(result).toContain('### Conditions');
        expect(result).toContain('## Exits from Current Location');
        expect(result).toContain('## Other Presences');
      });

      it('should include location name in Location section', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Abandoned Mine Shaft',
          darknessDescription: null,
          characterCount: 0,
        });

        const lines = result.split('\n');
        const locationIndex = lines.findIndex((l) => l === '### Location');
        expect(locationIndex).toBeGreaterThan(-1);
        expect(lines[locationIndex + 1]).toBe('Abandoned Mine Shaft');
      });

      it('should include "Pitch darkness" condition', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dark Room',
          darknessDescription: null,
          characterCount: 0,
        });

        expect(result).toContain(
          '**Pitch darkness.** You cannot see anything.'
        );
      });
    });

    describe('sensory impressions', () => {
      it('should include custom darkness description when provided', () => {
        const customDescription =
          'The air is thick with the smell of damp stone and decay.';
        const result = buildDarknessWorldContext({
          locationName: 'Dungeon',
          darknessDescription: customDescription,
          characterCount: 0,
        });

        expect(result).toContain('### Sensory Impressions');
        expect(result).toContain(customDescription);
      });

      it('should omit sensory section when no description provided', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dungeon',
          darknessDescription: null,
          characterCount: 0,
        });

        expect(result).not.toContain('### Sensory Impressions');
      });

      it('should omit sensory section for empty string description', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dungeon',
          darknessDescription: '',
          characterCount: 0,
        });

        // Empty string is falsy, so sensory section should be omitted
        expect(result).not.toContain('### Sensory Impressions');
      });
    });

    describe('exits handling', () => {
      it('should say "cannot see any exits" in darkness', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dark Room',
          darknessDescription: null,
          characterCount: 0,
        });

        expect(result).toContain('You cannot see any exits in the darkness.');
      });
    });

    describe('presence messages', () => {
      it('should return NONE presence message for 0 characters', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Empty Cave',
          darknessDescription: null,
          characterCount: 0,
        });

        expect(result).toContain(PRESENCE_MESSAGES.NONE);
      });

      it('should return ONE presence message for 1 character', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Cave',
          darknessDescription: null,
          characterCount: 1,
        });

        expect(result).toContain(PRESENCE_MESSAGES.ONE);
      });

      it('should return FEW presence message for 2 characters', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Cave',
          darknessDescription: null,
          characterCount: 2,
        });

        expect(result).toContain(PRESENCE_MESSAGES.FEW);
      });

      it('should return FEW presence message for 3 characters', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Cave',
          darknessDescription: null,
          characterCount: 3,
        });

        expect(result).toContain(PRESENCE_MESSAGES.FEW);
      });

      it('should return SEVERAL presence message for 4+ characters', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Crowded Cave',
          darknessDescription: null,
          characterCount: 4,
        });

        expect(result).toContain(PRESENCE_MESSAGES.SEVERAL);
      });

      it('should return SEVERAL presence message for many characters', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Very Crowded Cave',
          darknessDescription: null,
          characterCount: 10,
        });

        expect(result).toContain(PRESENCE_MESSAGES.SEVERAL);
      });
    });

    describe('complete output format', () => {
      it('should produce complete output with all sections in correct order', () => {
        const result = buildDarknessWorldContext({
          locationName: 'The Abyss',
          darknessDescription: 'You hear water dripping in the distance.',
          characterCount: 2,
        });

        const lines = result.split('\n');

        // Check section order
        const currentSituationIdx = lines.indexOf('## Current Situation');
        const locationIdx = lines.indexOf('### Location');
        const conditionsIdx = lines.indexOf('### Conditions');
        const sensoryIdx = lines.indexOf('### Sensory Impressions');
        const exitsIdx = lines.indexOf('## Exits from Current Location');
        const presencesIdx = lines.indexOf('## Other Presences');

        expect(currentSituationIdx).toBeLessThan(locationIdx);
        expect(locationIdx).toBeLessThan(conditionsIdx);
        expect(conditionsIdx).toBeLessThan(sensoryIdx);
        expect(sensoryIdx).toBeLessThan(exitsIdx);
        expect(exitsIdx).toBeLessThan(presencesIdx);
      });

      it('should not leak character details into output', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dark Room',
          darknessDescription: null,
          characterCount: 3,
        });

        // Character names or descriptions should not appear in the output
        // Only standard section headers should be present, not character name headers
        expect(result).not.toMatch(/- \*\*Apparent age\*\*/);
        expect(result).not.toMatch(/- \*\*Description\*\*/);
        // Verify no character-specific content (the builder only receives count, not details)
        expect(result).not.toContain('Character');
        expect(result).not.toContain('person');
      });

      it('should not include exit directions in output', () => {
        const result = buildDarknessWorldContext({
          locationName: 'Dark Room',
          darknessDescription: null,
          characterCount: 0,
        });

        // Exit directions should not appear
        expect(result).not.toContain('Towards');
        expect(result).not.toContain('leads to');
        expect(result).not.toMatch(/- \*\*.*\*\* leads to/);
      });
    });
  });
});
