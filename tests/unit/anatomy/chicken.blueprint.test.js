/**
 * @file Tests for chicken anatomy blueprints (rooster and hen)
 * @see specs/rooster-hen-anatomy-recipes.md
 * @see tickets/ROOHENANAREC-002-blueprints.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Chicken Blueprints', () => {
  let roosterBlueprint;
  let henBlueprint;

  beforeEach(() => {
    // Load the rooster blueprint
    const roosterPath = path.join(
      process.cwd(),
      'data/mods/anatomy/blueprints/rooster.blueprint.json'
    );
    roosterBlueprint = JSON.parse(fs.readFileSync(roosterPath, 'utf8'));

    // Load the hen blueprint
    const henPath = path.join(
      process.cwd(),
      'data/mods/anatomy/blueprints/hen.blueprint.json'
    );
    henBlueprint = JSON.parse(fs.readFileSync(henPath, 'utf8'));
  });

  describe('Rooster Blueprint', () => {
    describe('Basic Structure', () => {
      it('should have correct id', () => {
        expect(roosterBlueprint.id).toBe('anatomy:rooster');
      });

      it('should have chicken_torso as root', () => {
        expect(roosterBlueprint.root).toBe('anatomy:chicken_torso');
      });

      it('should have the correct schema reference', () => {
        expect(roosterBlueprint.$schema).toBe(
          'schema://living-narrative-engine/anatomy.blueprint.schema.json'
        );
      });

      it('should not use schemaVersion 2.0 (no structure template)', () => {
        expect(roosterBlueprint.schemaVersion).toBeUndefined();
      });
    });

    describe('Main Body Slots', () => {
      it('should have head slot attached to neck', () => {
        expect(roosterBlueprint.slots.head).toBeDefined();
        expect(roosterBlueprint.slots.head.socket).toBe('neck');
        expect(roosterBlueprint.slots.head.requirements.partType).toBe(
          'chicken_head'
        );
        expect(roosterBlueprint.slots.head.requirements.components).toContain(
          'anatomy:part'
        );
      });

      it('should have left_wing slot', () => {
        expect(roosterBlueprint.slots.left_wing).toBeDefined();
        expect(roosterBlueprint.slots.left_wing.requirements.partType).toBe(
          'chicken_wing'
        );
      });

      it('should have right_wing slot', () => {
        expect(roosterBlueprint.slots.right_wing).toBeDefined();
        expect(roosterBlueprint.slots.right_wing.requirements.partType).toBe(
          'chicken_wing'
        );
      });

      it('should have left_leg slot', () => {
        expect(roosterBlueprint.slots.left_leg).toBeDefined();
        expect(roosterBlueprint.slots.left_leg.socket).toBe('left_hip');
        expect(roosterBlueprint.slots.left_leg.requirements.partType).toBe(
          'chicken_leg'
        );
      });

      it('should have right_leg slot', () => {
        expect(roosterBlueprint.slots.right_leg).toBeDefined();
        expect(roosterBlueprint.slots.right_leg.socket).toBe('right_hip');
        expect(roosterBlueprint.slots.right_leg.requirements.partType).toBe(
          'chicken_leg'
        );
      });

      it('should have tail slot', () => {
        expect(roosterBlueprint.slots.tail).toBeDefined();
        expect(roosterBlueprint.slots.tail.socket).toBe('tail_root');
        expect(roosterBlueprint.slots.tail.requirements.partType).toBe(
          'chicken_tail'
        );
      });
    });

    describe('Head Slots (nested under head)', () => {
      it('should have beak slot attached to head', () => {
        expect(roosterBlueprint.slots.beak).toBeDefined();
        expect(roosterBlueprint.slots.beak.parent).toBe('head');
        expect(roosterBlueprint.slots.beak.requirements.partType).toBe(
          'chicken_beak'
        );
      });

      it('should have left_eye slot attached to head', () => {
        expect(roosterBlueprint.slots.left_eye).toBeDefined();
        expect(roosterBlueprint.slots.left_eye.parent).toBe('head');
        expect(roosterBlueprint.slots.left_eye.socket).toBe('left_eye');
        expect(roosterBlueprint.slots.left_eye.requirements.partType).toBe(
          'eye'
        );
      });

      it('should have right_eye slot attached to head', () => {
        expect(roosterBlueprint.slots.right_eye).toBeDefined();
        expect(roosterBlueprint.slots.right_eye.parent).toBe('head');
        expect(roosterBlueprint.slots.right_eye.socket).toBe('right_eye');
        expect(roosterBlueprint.slots.right_eye.requirements.partType).toBe(
          'eye'
        );
      });

      it('should have comb slot attached to head', () => {
        expect(roosterBlueprint.slots.comb).toBeDefined();
        expect(roosterBlueprint.slots.comb.parent).toBe('head');
        expect(roosterBlueprint.slots.comb.requirements.partType).toBe(
          'chicken_comb'
        );
      });

      it('should have wattle slot attached to head', () => {
        expect(roosterBlueprint.slots.wattle).toBeDefined();
        expect(roosterBlueprint.slots.wattle.parent).toBe('head');
        expect(roosterBlueprint.slots.wattle.requirements.partType).toBe(
          'chicken_wattle'
        );
      });
    });

    describe('Leg Slots (foot and spur)', () => {
      it('should have left_foot slot attached to left_leg', () => {
        expect(roosterBlueprint.slots.left_foot).toBeDefined();
        expect(roosterBlueprint.slots.left_foot.parent).toBe('left_leg');
        expect(roosterBlueprint.slots.left_foot.socket).toBe('foot');
        expect(roosterBlueprint.slots.left_foot.requirements.partType).toBe(
          'chicken_foot'
        );
      });

      it('should have right_foot slot attached to right_leg', () => {
        expect(roosterBlueprint.slots.right_foot).toBeDefined();
        expect(roosterBlueprint.slots.right_foot.parent).toBe('right_leg');
        expect(roosterBlueprint.slots.right_foot.socket).toBe('foot');
        expect(roosterBlueprint.slots.right_foot.requirements.partType).toBe(
          'chicken_foot'
        );
      });

      it('should have left_spur slot attached to left_leg', () => {
        expect(roosterBlueprint.slots.left_spur).toBeDefined();
        expect(roosterBlueprint.slots.left_spur.parent).toBe('left_leg');
        expect(roosterBlueprint.slots.left_spur.socket).toBe('spur');
        expect(roosterBlueprint.slots.left_spur.requirements.partType).toBe(
          'chicken_spur'
        );
      });

      it('should have right_spur slot attached to right_leg', () => {
        expect(roosterBlueprint.slots.right_spur).toBeDefined();
        expect(roosterBlueprint.slots.right_spur.parent).toBe('right_leg');
        expect(roosterBlueprint.slots.right_spur.socket).toBe('spur');
        expect(roosterBlueprint.slots.right_spur.requirements.partType).toBe(
          'chicken_spur'
        );
      });
    });
  });

  describe('Hen Blueprint', () => {
    describe('Basic Structure', () => {
      it('should have correct id', () => {
        expect(henBlueprint.id).toBe('anatomy:hen');
      });

      it('should have chicken_torso as root (same as rooster)', () => {
        expect(henBlueprint.root).toBe('anatomy:chicken_torso');
      });

      it('should have the correct schema reference', () => {
        expect(henBlueprint.$schema).toBe(
          'schema://living-narrative-engine/anatomy.blueprint.schema.json'
        );
      });
    });

    describe('Main Body Slots (same as rooster)', () => {
      it('should have head, wings, legs, and tail slots', () => {
        expect(henBlueprint.slots.head).toBeDefined();
        expect(henBlueprint.slots.left_wing).toBeDefined();
        expect(henBlueprint.slots.right_wing).toBeDefined();
        expect(henBlueprint.slots.left_leg).toBeDefined();
        expect(henBlueprint.slots.right_leg).toBeDefined();
        expect(henBlueprint.slots.tail).toBeDefined();
      });
    });

    describe('Head Slots (same as rooster)', () => {
      it('should have beak, eyes, comb, and wattle slots', () => {
        expect(henBlueprint.slots.beak).toBeDefined();
        expect(henBlueprint.slots.left_eye).toBeDefined();
        expect(henBlueprint.slots.right_eye).toBeDefined();
        expect(henBlueprint.slots.comb).toBeDefined();
        expect(henBlueprint.slots.wattle).toBeDefined();
      });
    });

    describe('Leg Slots (DIFFERENCE: no spurs)', () => {
      it('should have foot slots attached to legs', () => {
        expect(henBlueprint.slots.left_foot).toBeDefined();
        expect(henBlueprint.slots.left_foot.parent).toBe('left_leg');

        expect(henBlueprint.slots.right_foot).toBeDefined();
        expect(henBlueprint.slots.right_foot.parent).toBe('right_leg');
      });

      it('should NOT have spur slots (hens typically lack spurs)', () => {
        expect(henBlueprint.slots.left_spur).toBeUndefined();
        expect(henBlueprint.slots.right_spur).toBeUndefined();
      });
    });
  });

  describe('Rooster vs Hen Comparison', () => {
    it('should use the same root entity', () => {
      expect(roosterBlueprint.root).toBe(henBlueprint.root);
    });

    it('should have identical head structure', () => {
      const roosterHeadSlots = ['head', 'beak', 'left_eye', 'right_eye', 'comb', 'wattle'];
      const henHeadSlots = roosterHeadSlots;

      roosterHeadSlots.forEach(slotName => {
        expect(roosterBlueprint.slots[slotName]).toBeDefined();
      });

      henHeadSlots.forEach(slotName => {
        expect(henBlueprint.slots[slotName]).toBeDefined();
      });
    });

    it('should have spur slots only on rooster', () => {
      // Rooster has spurs
      expect(roosterBlueprint.slots.left_spur).toBeDefined();
      expect(roosterBlueprint.slots.right_spur).toBeDefined();

      // Hen does not have spurs
      expect(henBlueprint.slots.left_spur).toBeUndefined();
      expect(henBlueprint.slots.right_spur).toBeUndefined();
    });

    it('should have rooster with 2 more slots than hen (the spurs)', () => {
      const roosterSlotCount = Object.keys(roosterBlueprint.slots).length;
      const henSlotCount = Object.keys(henBlueprint.slots).length;

      expect(roosterSlotCount).toBe(henSlotCount + 2);
    });
  });
});
