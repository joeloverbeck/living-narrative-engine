import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Foot Entity Validation', () => {
  const footEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_foot.entity.json'),
      'utf-8'
    )
  );

  describe('tortoise_foot entity', () => {
    it('should have correct entity ID', () => {
      expect(footEntity.id).toBe('anatomy:tortoise_foot');
    });

    it('should have correct description', () => {
      expect(footEntity.description).toBe('Broad foot with three clawed toes');
    });

    it('should have anatomy:part component with tortoise_foot subType', () => {
      expect(footEntity.components['anatomy:part']).toBeDefined();
      expect(footEntity.components['anatomy:part'].subType).toBe('tortoise_foot');
    });

    it('should have core:name component with text "foot"', () => {
      expect(footEntity.components['core:name']).toBeDefined();
      expect(footEntity.components['core:name'].text).toBe('foot');
    });

    it('should have descriptors:texture component with "leathery" texture', () => {
      expect(footEntity.components['descriptors:texture']).toBeDefined();
      expect(footEntity.components['descriptors:texture'].texture).toBe('leathery');
    });

    it('should have descriptors:digit_count component with string "3"', () => {
      expect(footEntity.components['descriptors:digit_count']).toBeDefined();
      expect(footEntity.components['descriptors:digit_count'].count).toBe('3');
      expect(typeof footEntity.components['descriptors:digit_count'].count).toBe('string');
    });

    it('should have descriptors:projection component with "clawed" projection', () => {
      expect(footEntity.components['descriptors:projection']).toBeDefined();
      expect(footEntity.components['descriptors:projection'].projection).toBe('clawed');
    });

    it('should have descriptors:color_extended component with "sickly-gray-green" color', () => {
      expect(footEntity.components['descriptors:color_extended']).toBeDefined();
      expect(footEntity.components['descriptors:color_extended'].color).toBe(
        'sickly-gray-green'
      );
    });
  });

  describe('Terminal limb structure', () => {
    it('should NOT have anatomy:sockets component (terminal limb)', () => {
      expect(footEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have exactly 6 components (no sockets)', () => {
      const componentKeys = Object.keys(footEntity.components);
      expect(componentKeys.length).toBe(6);
    });
  });

  describe('Component structure', () => {
    it('should have all required components', () => {
      expect(footEntity.components['anatomy:part']).toBeDefined();
      expect(footEntity.components['core:name']).toBeDefined();
      expect(footEntity.components['descriptors:texture']).toBeDefined();
      expect(footEntity.components['descriptors:digit_count']).toBeDefined();
      expect(footEntity.components['descriptors:projection']).toBeDefined();
      expect(footEntity.components['descriptors:color_extended']).toBeDefined();
    });

    it('should have only the expected component keys', () => {
      const expectedKeys = [
        'anatomy:part',
        'core:name',
        'descriptors:texture',
        'descriptors:digit_count',
        'descriptors:projection',
        'descriptors:color_extended',
      ];
      const actualKeys = Object.keys(footEntity.components);
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(footEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have subType matching leg socket allowedTypes', () => {
      expect(footEntity.components['anatomy:part'].subType).toBe('tortoise_foot');
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
      expect(validTextures).toContain(footEntity.components['descriptors:texture'].texture);
    });

    it('should use valid digit count from schema enum', () => {
      const validCounts = ['3', '4', '5', '6+', 'abnormal'];
      expect(validCounts).toContain(footEntity.components['descriptors:digit_count'].count);
    });

    it('should use valid projection from schema enum', () => {
      const validProjections = ['flat', 'bubbly', 'shelf', 'clawed'];
      expect(validProjections).toContain(
        footEntity.components['descriptors:projection'].projection
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
      expect(validColors).toContain(footEntity.components['descriptors:color_extended'].color);
    });
  });

  describe('Invariants', () => {
    it('should be a terminal limb part (no sockets)', () => {
      expect(footEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have leathery texture consistent with reptilian anatomy', () => {
      expect(footEntity.components['descriptors:texture'].texture).toBe('leathery');
    });

    it('should have exactly 3 digits as specified for tortoise anatomy', () => {
      expect(footEntity.components['descriptors:digit_count'].count).toBe('3');
    });

    it('should have clawed projection characteristic', () => {
      expect(footEntity.components['descriptors:projection'].projection).toBe('clawed');
    });

    it('should have color consistent with tortoise appearance', () => {
      expect(footEntity.components['descriptors:color_extended'].color).toBe(
        'sickly-gray-green'
      );
    });
  });

  describe('Compatibility with leg socket', () => {
    const legEntity = JSON.parse(
      readFileSync(
        join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_leg.entity.json'),
        'utf-8'
      )
    );

    it('should be compatible with tortoise_leg foot socket', () => {
      const footSocket = legEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'foot'
      );
      expect(footSocket).toBeDefined();
      expect(footSocket.allowedTypes).toContain('tortoise_foot');
    });

    it('should match leg socket allowedTypes exactly', () => {
      const footSocket = legEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'foot'
      );
      expect(footEntity.components['anatomy:part'].subType).toBe(footSocket.allowedTypes[0]);
    });
  });
});
