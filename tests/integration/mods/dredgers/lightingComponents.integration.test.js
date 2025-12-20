/**
 * @file lightingComponents.integration.test.js
 * @description Integration tests for lighting components in dredgers underground locations.
 *
 * This test validates that:
 * 1. All underground locations have the required lighting components
 * 2. Lit locations (canal_vestibule, concordance_salon, outer_service_yard, service_stair)
 *    do NOT have the naturally_dark component
 * 3. Darkness descriptions meet quality requirements
 *
 * @see LIGSYSDES-007 for ticket details
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/dredgers/entities/definitions'
);

// Underground locations that should be naturally dark
const DARK_LOCATIONS = [
  'lower_gallery.location.json',
  'construction_zone.location.json',
  'access_point_segment_a.location.json',
  'segment_b.location.json',
  'segment_c.location.json',
  'flooded_approach.location.json',
];

// Lit locations that should NOT have naturally_dark
const LIT_LOCATIONS = [
  'canal_vestibule.location.json',
  'concordance_salon.location.json',
  'outer_service_yard.location.json',
  'service_stair.location.json',
];

// Sensory words that darkness descriptions should contain
const SENSORY_WORDS = [
  'hear',
  'feel',
  'smell',
  'cold',
  'sound',
  'echo',
  'scrape',
  'drip',
  'taste',
  'touch',
  'sense',
  'breath',
  'air',
  'wet',
  'damp',
  'temperature',
  'dark',
  'black',
  'silence',
  'thick',
  'heavy',
];

/**
 * Load a location definition file
 *
 * @param {string} filename - The location filename
 * @returns {object} Parsed location JSON
 */
function loadLocationDefinition(filename) {
  const filepath = path.join(DEFINITIONS_PATH, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Check if a text contains at least one sensory word
 *
 * @param {string} text - The text to check
 * @returns {boolean} True if at least one sensory word is found
 */
function containsSensoryWords(text) {
  const lowerText = text.toLowerCase();
  return SENSORY_WORDS.some((word) => lowerText.includes(word));
}

describe('dredgers mod: lighting components', () => {
  describe('Underground locations have required lighting components', () => {
    DARK_LOCATIONS.forEach((filename) => {
      describe(filename, () => {
        it('should have locations:naturally_dark component', () => {
          const location = loadLocationDefinition(filename);
          expect(location.components['locations:naturally_dark']).toBeDefined();
          expect(location.components['locations:naturally_dark']).toEqual({});
        });

        it('should have locations:description_in_darkness component with non-empty text', () => {
          const location = loadLocationDefinition(filename);
          expect(
            location.components['locations:description_in_darkness']
          ).toBeDefined();
          expect(
            location.components['locations:description_in_darkness'].text
          ).toBeDefined();
          expect(
            typeof location.components['locations:description_in_darkness'].text
          ).toBe('string');
          expect(
            location.components['locations:description_in_darkness'].text.length
          ).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Lit locations do NOT have naturally_dark component', () => {
    LIT_LOCATIONS.forEach((filename) => {
      it(`${filename} should NOT have locations:naturally_dark component`, () => {
        const location = loadLocationDefinition(filename);
        expect(
          location.components['locations:naturally_dark']
        ).toBeUndefined();
      });
    });
  });

  describe('Darkness description quality requirements', () => {
    DARK_LOCATIONS.forEach((filename) => {
      describe(filename, () => {
        it('should have darkness description of at least 100 characters', () => {
          const location = loadLocationDefinition(filename);
          const description =
            location.components['locations:description_in_darkness'].text;
          expect(description.length).toBeGreaterThanOrEqual(100);
        });

        it('should have darkness description focusing on non-visual senses', () => {
          const location = loadLocationDefinition(filename);
          const description =
            location.components['locations:description_in_darkness'].text;
          expect(containsSensoryWords(description)).toBe(true);
        });
      });
    });
  });

  describe('Component structure compliance', () => {
    it('should have exactly 6 underground locations with lighting components', () => {
      let count = 0;
      DARK_LOCATIONS.forEach((filename) => {
        const location = loadLocationDefinition(filename);
        if (location.components['locations:naturally_dark']) {
          count++;
        }
      });
      expect(count).toBe(6);
    });

    it('should have exactly 4 lit locations without naturally_dark', () => {
      let count = 0;
      LIT_LOCATIONS.forEach((filename) => {
        const location = loadLocationDefinition(filename);
        if (!location.components['locations:naturally_dark']) {
          count++;
        }
      });
      expect(count).toBe(4);
    });
  });

  describe('Mod manifest dependencies', () => {
    it('should have locations mod as a dependency in dredgers manifest', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/dredgers/mod-manifest.json'
      );
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      const hasLocationsDep = manifest.dependencies.some(
        (dep) => dep.id === 'locations'
      );
      expect(hasLocationsDep).toBe(true);
    });
  });
});
