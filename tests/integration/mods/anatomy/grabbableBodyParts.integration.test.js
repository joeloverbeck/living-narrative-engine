/**
 * @file Integration tests for body part entities with anatomy:can_grab component
 *
 * Validates that body parts capable of grabbing/holding items have the
 * anatomy:can_grab component correctly configured.
 * @see data/mods/anatomy/components/can_grab.component.json
 * @see tickets/APPGRAOCCSYS-007-can-grab-to-body-parts.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

const ANATOMY_ENTITIES_PATH = path.resolve(
  currentDirname,
  '../../../../data/mods/anatomy/entities/definitions'
);

/**
 * Load JSON entity file
 *
 * @param {string} filename - Entity filename
 * @returns {object} Parsed entity data
 */
function loadEntityFile(filename) {
  const filePath = path.join(ANATOMY_ENTITIES_PATH, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('Grabbable Body Parts Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Hand entities should have anatomy:can_grab component', () => {
    const handEntities = [
      { file: 'human_hand.entity.json', expectedGripStrength: 1.0 },
      {
        file: 'humanoid_hand_craftsman_stained.entity.json',
        expectedGripStrength: 1.0,
      },
      { file: 'humanoid_hand_scarred.entity.json', expectedGripStrength: 1.0 },
      {
        file: 'eldritch_malformed_hand.entity.json',
        expectedGripStrength: 0.7,
      },
      { file: 'tortoise_hand.entity.json', expectedGripStrength: 0.8 },
    ];

    it.each(handEntities)(
      'should have anatomy:can_grab component in $file',
      ({ file, expectedGripStrength }) => {
        const entity = loadEntityFile(file);

        expect(entity.components).toHaveProperty('anatomy:can_grab');
        const canGrab = entity.components['anatomy:can_grab'];

        expect(canGrab).toHaveProperty('locked', false);
        expect(canGrab).toHaveProperty('heldItemId', null);
        expect(canGrab).toHaveProperty('gripStrength', expectedGripStrength);
      }
    );
  });

  describe('Tentacle entities should have anatomy:can_grab component', () => {
    const tentacleEntities = [
      { file: 'squid_tentacle.entity.json', expectedGripStrength: 0.8 },
      { file: 'octopus_tentacle.entity.json', expectedGripStrength: 0.9 },
      { file: 'kraken_tentacle.entity.json', expectedGripStrength: 1.5 },
      {
        file: 'eldritch_tentacle_feeding.entity.json',
        expectedGripStrength: 0.6,
      },
      {
        file: 'eldritch_tentacle_large.entity.json',
        expectedGripStrength: 1.2,
      },
      {
        file: 'eldritch_tentacle_sensory.entity.json',
        expectedGripStrength: 0.3,
      },
    ];

    it.each(tentacleEntities)(
      'should have anatomy:can_grab component in $file',
      ({ file, expectedGripStrength }) => {
        const entity = loadEntityFile(file);

        expect(entity.components).toHaveProperty('anatomy:can_grab');
        const canGrab = entity.components['anatomy:can_grab'];

        expect(canGrab).toHaveProperty('locked', false);
        expect(canGrab).toHaveProperty('heldItemId', null);
        expect(canGrab).toHaveProperty('gripStrength', expectedGripStrength);
      }
    );
  });

  describe('Non-grabbable body parts should NOT have anatomy:can_grab', () => {
    const nonGrabbableEntities = [
      'human_foot.entity.json',
      'tortoise_foot.entity.json',
      'spider_leg.entity.json',
      'humanoid_head.entity.json',
      'humanoid_arm.entity.json', // Arms contain hands, but arms themselves don't grab
      'human_leg.entity.json',
    ];

    it.each(nonGrabbableEntities)(
      'should NOT have anatomy:can_grab component in %s',
      (file) => {
        const entity = loadEntityFile(file);
        expect(entity.components).not.toHaveProperty('anatomy:can_grab');
      }
    );
  });

  describe('anatomy:can_grab component invariants', () => {
    const allGrabbableEntities = [
      'human_hand.entity.json',
      'humanoid_hand_craftsman_stained.entity.json',
      'humanoid_hand_scarred.entity.json',
      'eldritch_malformed_hand.entity.json',
      'tortoise_hand.entity.json',
      'squid_tentacle.entity.json',
      'octopus_tentacle.entity.json',
      'kraken_tentacle.entity.json',
      'eldritch_tentacle_feeding.entity.json',
      'eldritch_tentacle_large.entity.json',
      'eldritch_tentacle_sensory.entity.json',
    ];

    it.each(allGrabbableEntities)(
      'should have locked: false (initially available) in %s',
      (file) => {
        const entity = loadEntityFile(file);
        expect(entity.components['anatomy:can_grab'].locked).toBe(false);
      }
    );

    it.each(allGrabbableEntities)(
      'should have heldItemId: null (not holding anything) in %s',
      (file) => {
        const entity = loadEntityFile(file);
        expect(entity.components['anatomy:can_grab'].heldItemId).toBeNull();
      }
    );

    it.each(allGrabbableEntities)(
      'should have gripStrength >= 0 in %s',
      (file) => {
        const entity = loadEntityFile(file);
        expect(
          entity.components['anatomy:can_grab'].gripStrength
        ).toBeGreaterThanOrEqual(0);
      }
    );

    it.each(allGrabbableEntities)(
      'should have components in alphabetical order in %s',
      (file) => {
        const entity = loadEntityFile(file);
        const componentKeys = Object.keys(entity.components);
        const sortedKeys = [...componentKeys].sort();
        expect(componentKeys).toEqual(sortedKeys);
      }
    );
  });

  describe('Grip strength value reasonableness', () => {
    it('should have human_hand gripStrength as the baseline (1.0)', () => {
      const entity = loadEntityFile('human_hand.entity.json');
      expect(entity.components['anatomy:can_grab'].gripStrength).toBe(1.0);
    });

    it('should have kraken_tentacle with highest grip strength (> 1.0)', () => {
      const entity = loadEntityFile('kraken_tentacle.entity.json');
      expect(
        entity.components['anatomy:can_grab'].gripStrength
      ).toBeGreaterThan(1.0);
    });

    it('should have eldritch_tentacle_sensory with lowest grip strength (< 0.5)', () => {
      const entity = loadEntityFile('eldritch_tentacle_sensory.entity.json');
      expect(entity.components['anatomy:can_grab'].gripStrength).toBeLessThan(
        0.5
      );
    });

    it('should have eldritch_malformed_hand with reduced grip strength', () => {
      const humanHand = loadEntityFile('human_hand.entity.json');
      const eldritchHand = loadEntityFile(
        'eldritch_malformed_hand.entity.json'
      );
      expect(
        eldritchHand.components['anatomy:can_grab'].gripStrength
      ).toBeLessThan(humanHand.components['anatomy:can_grab'].gripStrength);
    });

    it('should have tortoise_hand with reduced grip strength (3 digits)', () => {
      const humanHand = loadEntityFile('human_hand.entity.json');
      const tortoiseHand = loadEntityFile('tortoise_hand.entity.json');
      expect(
        tortoiseHand.components['anatomy:can_grab'].gripStrength
      ).toBeLessThan(humanHand.components['anatomy:can_grab'].gripStrength);
    });
  });
});
