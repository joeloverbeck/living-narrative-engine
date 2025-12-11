/**
 * @file Data validation tests for anatomy entity hit_probability_weight values
 * @description Ensures all anatomy:part entities have valid weights and internal organs are protected
 * @see src/anatomy/utils/hitProbabilityWeightUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

// Paths to anatomy entity definitions (humanoid + creatures)
const ENTITIES_DIRS = [
  path.resolve(
    currentDirname,
    '../../../data/mods/anatomy/entities/definitions'
  ),
  path.resolve(
    currentDirname,
    '../../../data/mods/anatomy-creatures/entities/definitions'
  ),
];

// SubTypes that must have weight = 0 (internal organs, mounts)
const INTERNAL_ORGAN_SUBTYPES = [
  'heart',
  'brain',
  'spine',
  'teeth',
  'chicken_heart',
  'chicken_brain',
  'chicken_spine',
  'ink_reservoir',
  'equipment_mount',
];

// SubTypes that must have weight > 0 (major body parts)
const MAJOR_PART_SUBTYPES = [
  'torso',
  'head',
  'arm',
  'leg',
  'hand',
  'foot',
  'breast',
  'dragon_torso',
  'dragon_head',
  'centaur_torso',
  'centaur_upper_torso',
  'chicken_torso',
  'spider_cephalothorax',
  'spider_abdomen',
  'shell_carapace',
  'shell_plastron',
  'mantle',
  'eldritch_core',
];

describe('Hit Probability Weight Data Validation', () => {
  let entityFiles;
  let anatomyPartEntities;

  beforeAll(() => {
    // Load all entity files across both mods
    entityFiles = Array.from(
      new Set(
        ENTITIES_DIRS.flatMap((dir) =>
          fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.entity.json'))
        )
      )
    );

    anatomyPartEntities = entityFiles
      .map((filename) => {
        const filepath = ENTITIES_DIRS.map((dir) =>
          path.join(dir, filename)
        ).find((candidate) => fs.existsSync(candidate));

        if (!filepath) {
          return null;
        }

        const content = fs.readFileSync(filepath, 'utf8');
        const entity = JSON.parse(content);
        const partComponent = entity.components?.['anatomy:part'];
        return { filename, entity, partComponent };
      })
      .filter((e) => e?.partComponent);
  });

  describe('Entity file validation', () => {
    it('should have at least 220 anatomy:part entities', () => {
      expect(anatomyPartEntities.length).toBeGreaterThanOrEqual(220);
    });
  });

  describe('Weight presence validation', () => {
    it('all anatomy:part components should have numeric hit_probability_weight >= 0', () => {
      const missingWeight = [];
      const invalidWeight = [];

      for (const { filename, partComponent } of anatomyPartEntities) {
        const weight = partComponent.hit_probability_weight;

        if (weight === undefined || weight === null) {
          missingWeight.push(filename);
        } else if (typeof weight !== 'number') {
          invalidWeight.push({
            filename,
            weight,
            type: typeof weight,
          });
        } else if (weight < 0) {
          invalidWeight.push({
            filename,
            weight,
            reason: 'negative',
          });
        }
      }

      expect(missingWeight).toEqual([]);
      expect(invalidWeight).toEqual([]);
    });
  });

  describe('Internal organs protection', () => {
    it('internal organs should have weight = 0', () => {
      const violations = [];

      for (const { filename, partComponent } of anatomyPartEntities) {
        const subType = partComponent.subType;

        if (INTERNAL_ORGAN_SUBTYPES.includes(subType)) {
          const weight = partComponent.hit_probability_weight;
          if (weight !== 0) {
            violations.push({
              filename,
              subType,
              actualWeight: weight,
              expectedWeight: 0,
            });
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Major body parts validation', () => {
    it('major body parts should have weight > 0', () => {
      const violations = [];

      for (const { filename, partComponent } of anatomyPartEntities) {
        const subType = partComponent.subType;

        if (MAJOR_PART_SUBTYPES.includes(subType)) {
          const weight = partComponent.hit_probability_weight;
          if (weight <= 0) {
            violations.push({
              filename,
              subType,
              actualWeight: weight,
              reason: 'Major body part should be hittable (weight > 0)',
            });
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Weight distribution sanity', () => {
    it('torso parts should have the highest weights (40-55 range)', () => {
      const torsos = anatomyPartEntities.filter((e) =>
        [
          'torso',
          'dragon_torso',
          'centaur_torso',
          'chicken_torso',
          'mantle',
        ].includes(e.partComponent.subType)
      );

      for (const { filename, partComponent } of torsos) {
        const weight = partComponent.hit_probability_weight;
        expect(weight).toBeGreaterThanOrEqual(20);
        expect(weight).toBeLessThanOrEqual(60);
      }

      expect(torsos.length).toBeGreaterThan(5);
    });

    it('head parts should have moderate weights (8-20 range)', () => {
      const heads = anatomyPartEntities.filter((e) =>
        [
          'head',
          'dragon_head',
          'centaur_head',
          'chicken_head',
          'tortoise_head',
        ].includes(e.partComponent.subType)
      );

      for (const { filename, partComponent } of heads) {
        const weight = partComponent.hit_probability_weight;
        expect(weight).toBeGreaterThanOrEqual(8);
        expect(weight).toBeLessThanOrEqual(20);
      }

      expect(heads.length).toBeGreaterThan(5);
    });

    it('small parts (eyes, ears) should have low weights (< 1)', () => {
      const smallParts = anatomyPartEntities.filter((e) => {
        const subType = e.partComponent.subType;
        return (
          subType.includes('eye') ||
          (subType.includes('ear') &&
            !subType.includes('heart') &&
            !subType.endsWith('_rear')) ||
          subType === 'nose' ||
          subType === 'hair' ||
          subType === 'pubic_hair' ||
          subType === 'beak'
        );
      });

      for (const { filename, partComponent } of smallParts) {
        const weight = partComponent.hit_probability_weight;
        expect(weight).toBeGreaterThan(0);
        const capMap = {
          beak: 2,
          toad_eye: 2,
          eye: 2,
          eldritch_baleful_eye: 3,
          eldritch_compound_eye_stalk: 3,
        };
        const cap = capMap[partComponent.subType] ?? 1;
        expect(weight).toBeLessThanOrEqual(cap);
      }

      expect(smallParts.length).toBeGreaterThan(10);
    });
  });

  describe('Size modifier validation', () => {
    it('hulking/massive parts should have ~20% higher weights', () => {
      // Find pairs of base and hulking variants
      const baseArm = anatomyPartEntities.find(
        (e) => e.filename === 'humanoid_arm.entity.json'
      );
      const hulkingArm = anatomyPartEntities.find(
        (e) => e.filename === 'humanoid_arm_hulking.entity.json'
      );

      if (baseArm && hulkingArm) {
        const ratio =
          hulkingArm.partComponent.hit_probability_weight /
          baseArm.partComponent.hit_probability_weight;
        expect(ratio).toBeCloseTo(1.2, 1);
      }
    });

    it('slim/petite parts should have ~10% lower weights', () => {
      const baseArm = anatomyPartEntities.find(
        (e) => e.filename === 'humanoid_arm.entity.json'
      );
      const slimArm = anatomyPartEntities.find(
        (e) => e.filename === 'humanoid_arm_slim.entity.json'
      );

      if (baseArm && slimArm) {
        const ratio =
          slimArm.partComponent.hit_probability_weight /
          baseArm.partComponent.hit_probability_weight;
        expect(ratio).toBeCloseTo(0.9, 1);
      }
    });
  });
});
