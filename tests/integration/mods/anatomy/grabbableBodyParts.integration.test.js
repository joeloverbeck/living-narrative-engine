/**
 * @file Integration tests for body part entities with anatomy:can_grab component
 *
 * Validates that body parts capable of grabbing/holding items have the
 * anatomy:can_grab component correctly configured.
 * Human body parts are in the anatomy mod, creature body parts are in anatomy-creatures.
 * @see data/mods/anatomy/components/can_grab.component.json
 * @see data/mods/anatomy-creatures/entities/definitions/
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

const ANATOMY_CREATURES_ENTITIES_PATH = path.resolve(
  currentDirname,
  '../../../../data/mods/anatomy-creatures/entities/definitions'
);

/**
 * Load JSON entity file from the appropriate mod directory
 *
 * @param {string} filename - Entity filename
 * @param {'anatomy'|'anatomy-creatures'} mod - Which mod contains the entity
 * @returns {object} Parsed entity data
 */
function loadEntityFile(filename, mod = 'anatomy') {
  const basePath =
    mod === 'anatomy-creatures'
      ? ANATOMY_CREATURES_ENTITIES_PATH
      : ANATOMY_ENTITIES_PATH;
  const filePath = path.join(basePath, filename);
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
      { file: 'human_hand.entity.json', expectedGripStrength: 1.0, mod: 'anatomy' },
      {
        file: 'humanoid_hand_craftsman_stained.entity.json',
        expectedGripStrength: 1.0,
        mod: 'anatomy',
      },
      { file: 'humanoid_hand_scarred.entity.json', expectedGripStrength: 1.0, mod: 'anatomy' },
      {
        file: 'eldritch_malformed_hand.entity.json',
        expectedGripStrength: 0.7,
        mod: 'anatomy-creatures',
      },
      { file: 'tortoise_hand.entity.json', expectedGripStrength: 0.8, mod: 'anatomy-creatures' },
    ];

    it.each(handEntities)(
      'should have anatomy:can_grab component in $file',
      ({ file, expectedGripStrength, mod }) => {
        const entity = loadEntityFile(file, mod);

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
      { file: 'squid_tentacle.entity.json', expectedGripStrength: 0.8, mod: 'anatomy-creatures' },
      { file: 'octopus_tentacle.entity.json', expectedGripStrength: 0.9, mod: 'anatomy-creatures' },
      { file: 'kraken_tentacle.entity.json', expectedGripStrength: 1.5, mod: 'anatomy-creatures' },
      {
        file: 'eldritch_tentacle_feeding.entity.json',
        expectedGripStrength: 0.6,
        mod: 'anatomy-creatures',
      },
      {
        file: 'eldritch_tentacle_large.entity.json',
        expectedGripStrength: 1.2,
        mod: 'anatomy-creatures',
      },
      {
        file: 'eldritch_tentacle_sensory.entity.json',
        expectedGripStrength: 0.3,
        mod: 'anatomy-creatures',
      },
    ];

    it.each(tentacleEntities)(
      'should have anatomy:can_grab component in $file',
      ({ file, expectedGripStrength, mod }) => {
        const entity = loadEntityFile(file, mod);

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
      { file: 'human_foot.entity.json', mod: 'anatomy' },
      { file: 'tortoise_foot.entity.json', mod: 'anatomy-creatures' },
      { file: 'spider_leg.entity.json', mod: 'anatomy-creatures' },
      { file: 'humanoid_head.entity.json', mod: 'anatomy' },
      { file: 'humanoid_arm.entity.json', mod: 'anatomy' }, // Arms contain hands, but arms themselves don't grab
      { file: 'human_leg.entity.json', mod: 'anatomy' },
    ];

    it.each(nonGrabbableEntities)(
      'should NOT have anatomy:can_grab component in $file',
      ({ file, mod }) => {
        const entity = loadEntityFile(file, mod);
        expect(entity.components).not.toHaveProperty('anatomy:can_grab');
      }
    );
  });

  describe('anatomy:can_grab component invariants', () => {
    const allGrabbableEntities = [
      { file: 'human_hand.entity.json', mod: 'anatomy' },
      { file: 'humanoid_hand_craftsman_stained.entity.json', mod: 'anatomy' },
      { file: 'humanoid_hand_scarred.entity.json', mod: 'anatomy' },
      { file: 'eldritch_malformed_hand.entity.json', mod: 'anatomy-creatures' },
      { file: 'tortoise_hand.entity.json', mod: 'anatomy-creatures' },
      { file: 'squid_tentacle.entity.json', mod: 'anatomy-creatures' },
      { file: 'octopus_tentacle.entity.json', mod: 'anatomy-creatures' },
      { file: 'kraken_tentacle.entity.json', mod: 'anatomy-creatures' },
      { file: 'eldritch_tentacle_feeding.entity.json', mod: 'anatomy-creatures' },
      { file: 'eldritch_tentacle_large.entity.json', mod: 'anatomy-creatures' },
      { file: 'eldritch_tentacle_sensory.entity.json', mod: 'anatomy-creatures' },
    ];

    it.each(allGrabbableEntities)(
      'should have locked: false (initially available) in $file',
      ({ file, mod }) => {
        const entity = loadEntityFile(file, mod);
        expect(entity.components['anatomy:can_grab'].locked).toBe(false);
      }
    );

    it.each(allGrabbableEntities)(
      'should have heldItemId: null (not holding anything) in $file',
      ({ file, mod }) => {
        const entity = loadEntityFile(file, mod);
        expect(entity.components['anatomy:can_grab'].heldItemId).toBeNull();
      }
    );

    it.each(allGrabbableEntities)(
      'should have gripStrength >= 0 in $file',
      ({ file, mod }) => {
        const entity = loadEntityFile(file, mod);
        expect(
          entity.components['anatomy:can_grab'].gripStrength
        ).toBeGreaterThanOrEqual(0);
      }
    );

    it.each(allGrabbableEntities)(
      'should have components in alphabetical order in $file',
      ({ file, mod }) => {
        const entity = loadEntityFile(file, mod);
        const componentKeys = Object.keys(entity.components);
        const sortedKeys = [...componentKeys].sort();
        expect(componentKeys).toEqual(sortedKeys);
      }
    );
  });

  describe('Grip strength value reasonableness', () => {
    it('should have human_hand gripStrength as the baseline (1.0)', () => {
      const entity = loadEntityFile('human_hand.entity.json', 'anatomy');
      expect(entity.components['anatomy:can_grab'].gripStrength).toBe(1.0);
    });

    it('should have kraken_tentacle with highest grip strength (> 1.0)', () => {
      const entity = loadEntityFile('kraken_tentacle.entity.json', 'anatomy-creatures');
      expect(
        entity.components['anatomy:can_grab'].gripStrength
      ).toBeGreaterThan(1.0);
    });

    it('should have eldritch_tentacle_sensory with lowest grip strength (< 0.5)', () => {
      const entity = loadEntityFile('eldritch_tentacle_sensory.entity.json', 'anatomy-creatures');
      expect(entity.components['anatomy:can_grab'].gripStrength).toBeLessThan(
        0.5
      );
    });

    it('should have eldritch_malformed_hand with reduced grip strength', () => {
      const humanHand = loadEntityFile('human_hand.entity.json', 'anatomy');
      const eldritchHand = loadEntityFile(
        'eldritch_malformed_hand.entity.json',
        'anatomy-creatures'
      );
      expect(
        eldritchHand.components['anatomy:can_grab'].gripStrength
      ).toBeLessThan(humanHand.components['anatomy:can_grab'].gripStrength);
    });

    it('should have tortoise_hand with reduced grip strength (3 digits)', () => {
      const humanHand = loadEntityFile('human_hand.entity.json', 'anatomy');
      const tortoiseHand = loadEntityFile('tortoise_hand.entity.json', 'anatomy-creatures');
      expect(
        tortoiseHand.components['anatomy:can_grab'].gripStrength
      ).toBeLessThan(humanHand.components['anatomy:can_grab'].gripStrength);
    });
  });
});
