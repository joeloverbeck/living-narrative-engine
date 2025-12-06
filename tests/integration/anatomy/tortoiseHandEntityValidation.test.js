import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Hand Entity Validation', () => {
  const handEntity = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'data/mods/anatomy/entities/definitions/tortoise_hand.entity.json'
      ),
      'utf-8'
    )
  );

  describe('tortoise_hand entity', () => {
    it('should have correct entity ID', () => {
      expect(handEntity.id).toBe('anatomy:tortoise_hand');
    });

    it('should have correct description', () => {
      expect(handEntity.description).toBe(
        'Thick-skinned hand with three prominent claws'
      );
    });

    it('should have anatomy:part component with tortoise_hand subType', () => {
      expect(handEntity.components['anatomy:part']).toBeDefined();
      expect(handEntity.components['anatomy:part'].subType).toBe(
        'tortoise_hand'
      );
    });

    it('should have core:name component with text "hand"', () => {
      expect(handEntity.components['core:name']).toBeDefined();
      expect(handEntity.components['core:name'].text).toBe('hand');
    });

    it('should have descriptors:texture component with "leathery" texture', () => {
      expect(handEntity.components['descriptors:texture']).toBeDefined();
      expect(handEntity.components['descriptors:texture'].texture).toBe(
        'leathery'
      );
    });

    it('should have descriptors:digit_count component with string "3"', () => {
      expect(handEntity.components['descriptors:digit_count']).toBeDefined();
      expect(handEntity.components['descriptors:digit_count'].count).toBe('3');
      expect(
        typeof handEntity.components['descriptors:digit_count'].count
      ).toBe('string');
    });

    it('should have descriptors:projection component with "clawed" projection', () => {
      expect(handEntity.components['descriptors:projection']).toBeDefined();
      expect(handEntity.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
    });

    it('should have descriptors:color_extended component with "sickly-gray-green" color', () => {
      expect(handEntity.components['descriptors:color_extended']).toBeDefined();
      expect(handEntity.components['descriptors:color_extended'].color).toBe(
        'sickly-gray-green'
      );
    });
  });

  describe('Terminal limb structure', () => {
    it('should NOT have anatomy:sockets component (terminal limb)', () => {
      expect(handEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have exactly 9 components (no sockets, includes core:weight)', () => {
      const componentKeys = Object.keys(handEntity.components);
      expect(componentKeys.length).toBe(9);
    });
  });

  describe('Component structure', () => {
    it('should have all required components', () => {
      expect(handEntity.components['anatomy:can_grab']).toBeDefined();
      expect(handEntity.components['anatomy:part']).toBeDefined();
      expect(handEntity.components['anatomy:part_health']).toBeDefined();
      expect(handEntity.components['core:name']).toBeDefined();
      expect(handEntity.components['descriptors:texture']).toBeDefined();
      expect(handEntity.components['descriptors:digit_count']).toBeDefined();
      expect(handEntity.components['descriptors:projection']).toBeDefined();
      expect(handEntity.components['descriptors:color_extended']).toBeDefined();
    });

    it('should have anatomy:can_grab component with grabbing capability', () => {
      const canGrab = handEntity.components['anatomy:can_grab'];
      expect(canGrab.gripStrength).toBe(0.8);
      expect(canGrab.heldItemId).toBeNull();
      expect(canGrab.locked).toBe(false);
    });

    it('should have only the expected component keys', () => {
      const expectedKeys = [
        'anatomy:can_grab',
        'anatomy:part',
        'anatomy:part_health',
        'core:name',
        'descriptors:color_extended',
        'descriptors:digit_count',
        'descriptors:projection',
        'descriptors:texture',
        'core:weight',
      ];
      const actualKeys = Object.keys(handEntity.components);
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(handEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have subType matching arm socket allowedTypes', () => {
      expect(handEntity.components['anatomy:part'].subType).toBe(
        'tortoise_hand'
      );
    });
  });

  describe('Descriptor validation', () => {
    it('should use valid texture value from schema enum', () => {
      const validTextures = [
        'bumpy',
        'chitinous',
        'coarse',
        'concentric-teeth',
        'croc-embossed',
        'faceted',
        'fleece',
        'fuzzy',
        'glossy',
        'leathery',
        'lipless-slit',
        'matte',
        'mucous',
        'nodular-receptors',
        'pale-clammy',
        'rib-knit',
        'ridged',
        'rough',
        'rugged',
        'scarred',
        'scaled',
        'serrated-edges',
        'silky',
        'slick',
        'slimy',
        'smooth',
        'smooth-muscular',
        'smooth-segmented',
        'soft',
        'suckered',
        'terry',
        'translucent',
        'translucent-slick',
        'translucent-veined',
        'velvety',
        'webbed-clawed',
      ];
      expect(validTextures).toContain(
        handEntity.components['descriptors:texture'].texture
      );
    });

    it('should use valid digit count from schema enum', () => {
      const validCounts = ['3', '4', '5', '6+', 'abnormal'];
      expect(validCounts).toContain(
        handEntity.components['descriptors:digit_count'].count
      );
    });

    it('should use valid projection from schema enum', () => {
      const validProjections = ['flat', 'bubbly', 'shelf', 'clawed'];
      expect(validProjections).toContain(
        handEntity.components['descriptors:projection'].projection
      );
    });

    it('should use valid color from schema enum', () => {
      const validColors = [
        'abyssal-black',
        'amber',
        'auburn',
        'blood-red',
        'blonde',
        'blush-pink',
        'bronze',
        'brown-grey-mixed',
        'brunette',
        'charcoal-gray',
        'cobalt',
        'corpse-pale',
        'cream',
        'crimson',
        'dark-olive',
        'dark-purple',
        'deep-crimson',
        'deep-navy',
        'gold',
        'hazel',
        'indigo',
        'iridescent-blue-green',
        'iridescent-green',
        'midnight-blue',
        'mottled-gray',
        'mottled-purple-gray',
        'murky-green',
        'navy',
        'nude',
        'pale-blue',
        'ice-blue',
        'pale-pink',
        'pale-pink-internal-organs-visible',
        'pale-translucent',
        'pearl-white',
        'powder-pink',
        'pupil-less-amber',
        'raven-black',
        'reddish-brown',
        'sand-beige',
        'sickly-gray-green',
        'silver',
        'smoke-black',
        'tan-brown',
        'taupe',
        'translucent-white',
        'varied-human-colors',
        'violet',
        'warm-brown',
      ];
      expect(validColors).toContain(
        handEntity.components['descriptors:color_extended'].color
      );
    });
  });

  describe('Invariants', () => {
    it('should be a terminal limb part (no sockets)', () => {
      expect(handEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have leathery texture consistent with reptilian anatomy', () => {
      expect(handEntity.components['descriptors:texture'].texture).toBe(
        'leathery'
      );
    });

    it('should have exactly 3 digits as specified for tortoise anatomy', () => {
      expect(handEntity.components['descriptors:digit_count'].count).toBe('3');
    });

    it('should have clawed projection characteristic', () => {
      expect(handEntity.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
    });

    it('should have color consistent with tortoise appearance', () => {
      expect(handEntity.components['descriptors:color_extended'].color).toBe(
        'sickly-gray-green'
      );
    });
  });

  describe('Compatibility with arm socket', () => {
    const armEntity = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'data/mods/anatomy/entities/definitions/tortoise_arm.entity.json'
        ),
        'utf-8'
      )
    );

    it('should be compatible with tortoise_arm hand socket', () => {
      const handSocket = armEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'hand'
      );
      expect(handSocket).toBeDefined();
      expect(handSocket.allowedTypes).toContain('tortoise_hand');
    });

    it('should match arm socket allowedTypes exactly', () => {
      const handSocket = armEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'hand'
      );
      expect(handEntity.components['anatomy:part'].subType).toBe(
        handSocket.allowedTypes[0]
      );
    });
  });
});
