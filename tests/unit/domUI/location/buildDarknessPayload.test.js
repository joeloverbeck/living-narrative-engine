// tests/unit/domUI/location/buildDarknessPayload.test.js
/**
 * @file Unit tests for buildDarknessPayload helper.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildDarknessPayload,
  DEFAULT_DARKNESS_DESCRIPTION,
} from '../../../../src/domUI/location/buildDarknessPayload.js';

describe('buildDarknessPayload', () => {
  describe('isDark flag', () => {
    it('should always return isDark: true', () => {
      const result = buildDarknessPayload({
        locationName: 'Test Location',
        darknessDescription: null,
        otherActorCount: 0,
      });
      expect(result.isDark).toBe(true);
    });
  });

  describe('exits and characters arrays', () => {
    it('should return empty exits array', () => {
      const result = buildDarknessPayload({
        locationName: 'Test Location',
        darknessDescription: null,
        otherActorCount: 3,
      });
      expect(result.exits).toEqual([]);
    });

    it('should return empty characters array', () => {
      const result = buildDarknessPayload({
        locationName: 'Test Location',
        darknessDescription: null,
        otherActorCount: 5,
      });
      expect(result.characters).toEqual([]);
    });
  });

  describe('portrait data', () => {
    it('should return portraitPath as null', () => {
      const result = buildDarknessPayload({
        locationName: 'Test Location',
        darknessDescription: 'Custom description',
        otherActorCount: 0,
      });
      expect(result.portraitPath).toBeNull();
    });

    it('should return portraitAltText as null', () => {
      const result = buildDarknessPayload({
        locationName: 'Test Location',
        darknessDescription: 'Custom description',
        otherActorCount: 0,
      });
      expect(result.portraitAltText).toBeNull();
    });
  });

  describe('description handling', () => {
    it('should use custom darkness description when provided', () => {
      const customDescription =
        'The damp air chills your skin. Water drips somewhere nearby.';
      const result = buildDarknessPayload({
        locationName: 'Dark Cave',
        darknessDescription: customDescription,
        otherActorCount: 0,
      });
      expect(result.description).toBe(customDescription);
    });

    it('should use default description when no custom provided (null)', () => {
      const result = buildDarknessPayload({
        locationName: 'Dark Room',
        darknessDescription: null,
        otherActorCount: 0,
      });
      expect(result.description).toBe(DEFAULT_DARKNESS_DESCRIPTION);
    });

    it('should use default description when no custom provided (undefined)', () => {
      const result = buildDarknessPayload({
        locationName: 'Dark Room',
        darknessDescription: undefined,
        otherActorCount: 0,
      });
      expect(result.description).toBe(DEFAULT_DARKNESS_DESCRIPTION);
    });

    it('should use default description when empty string provided', () => {
      const result = buildDarknessPayload({
        locationName: 'Dark Room',
        darknessDescription: '',
        otherActorCount: 0,
      });
      expect(result.description).toBe(DEFAULT_DARKNESS_DESCRIPTION);
    });
  });

  describe('location name preservation', () => {
    it('should preserve the location name', () => {
      const result = buildDarknessPayload({
        locationName: 'The Deepest Dungeon',
        darknessDescription: null,
        otherActorCount: 0,
      });
      expect(result.name).toBe('The Deepest Dungeon');
    });

    it('should preserve location name with special characters', () => {
      const result = buildDarknessPayload({
        locationName: "O'Malley's Cellar",
        darknessDescription: null,
        otherActorCount: 0,
      });
      expect(result.name).toBe("O'Malley's Cellar");
    });
  });

  describe('otherActorCount', () => {
    it('should include otherActorCount of 0', () => {
      const result = buildDarknessPayload({
        locationName: 'Empty Room',
        darknessDescription: null,
        otherActorCount: 0,
      });
      expect(result.otherActorCount).toBe(0);
    });

    it('should include otherActorCount for one actor', () => {
      const result = buildDarknessPayload({
        locationName: 'Room',
        darknessDescription: null,
        otherActorCount: 1,
      });
      expect(result.otherActorCount).toBe(1);
    });

    it('should include otherActorCount for several actors', () => {
      const result = buildDarknessPayload({
        locationName: 'Room',
        darknessDescription: null,
        otherActorCount: 5,
      });
      expect(result.otherActorCount).toBe(5);
    });
  });

  describe('default darkness description constant', () => {
    it('should export the default description constant', () => {
      expect(DEFAULT_DARKNESS_DESCRIPTION).toBe("You're in pitch darkness.");
    });
  });

  describe('complete payload structure', () => {
    it('should return a complete LocationDisplayPayload structure', () => {
      const result = buildDarknessPayload({
        locationName: 'Dark Place',
        darknessDescription: 'You hear dripping water.',
        otherActorCount: 2,
      });

      expect(result).toEqual({
        name: 'Dark Place',
        description: 'You hear dripping water.',
        portraitPath: null,
        portraitAltText: null,
        exits: [],
        characters: [],
        isDark: true,
        otherActorCount: 2,
      });
    });
  });
});
