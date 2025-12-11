import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Beak Entity Validation', () => {
  const beakEntity = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json'
      ),
      'utf-8'
    )
  );

  describe('tortoise_beak entity', () => {
    it('should have correct entity ID', () => {
      expect(beakEntity.id).toBe('anatomy-creatures:tortoise_beak');
    });

    it('should have correct description', () => {
      expect(beakEntity.description).toBe(
        'Horny beak structure for herbivorous diet'
      );
    });

    it('should have anatomy:part component with tortoise_beak subType', () => {
      expect(beakEntity.components['anatomy:part']).toBeDefined();
      expect(beakEntity.components['anatomy:part'].subType).toBe(
        'tortoise_beak'
      );
    });

    it('should have core:name component with text "beak"', () => {
      expect(beakEntity.components['core:name']).toBeDefined();
      expect(beakEntity.components['core:name'].text).toBe('beak');
    });

    it('should have descriptors:texture component with "ridged" texture', () => {
      expect(beakEntity.components['descriptors:texture']).toBeDefined();
      expect(beakEntity.components['descriptors:texture'].texture).toBe(
        'ridged'
      );
    });

    it('should have descriptors:color_extended component with "charcoal-gray" color', () => {
      expect(beakEntity.components['descriptors:color_extended']).toBeDefined();
      expect(beakEntity.components['descriptors:color_extended'].color).toBe(
        'charcoal-gray'
      );
    });

    it('should have descriptors:shape_general component with "hooked" shape', () => {
      expect(beakEntity.components['descriptors:shape_general']).toBeDefined();
      expect(beakEntity.components['descriptors:shape_general'].shape).toBe(
        'hooked'
      );
    });
  });

  describe('Component structure', () => {
    it('should have exactly 8 components (includes core:weight and damage capabilities)', () => {
      const componentKeys = Object.keys(beakEntity.components);
      expect(componentKeys.length).toBe(8);
    });

    it('should have all required components', () => {
      expect(beakEntity.components['anatomy:part']).toBeDefined();
      expect(beakEntity.components['anatomy:part_health']).toBeDefined();
      expect(beakEntity.components['core:name']).toBeDefined();
      expect(beakEntity.components['descriptors:texture']).toBeDefined();
      expect(beakEntity.components['descriptors:color_extended']).toBeDefined();
      expect(beakEntity.components['descriptors:shape_general']).toBeDefined();
      expect(
        beakEntity.components['damage-types:damage_capabilities']
      ).toBeDefined();
    });

    it('should not have anatomy:sockets component (mounted part)', () => {
      expect(beakEntity.components['anatomy:sockets']).toBeUndefined();
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(beakEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have unique subType for tortoise beak', () => {
      expect(beakEntity.components['anatomy:part'].subType).toBe(
        'tortoise_beak'
      );
    });
  });

  describe('Socket compatibility', () => {
    it('should have subType that matches head beak_mount allowedTypes', () => {
      const headEntity = JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            'data/mods/anatomy-creatures/entities/definitions/tortoise_head.entity.json'
          ),
          'utf-8'
        )
      );

      const beakSocket = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'beak_mount'
      );

      expect(beakSocket).toBeDefined();
      expect(beakSocket.allowedTypes).toContain('tortoise_beak');
      expect(beakEntity.components['anatomy:part'].subType).toBe(
        'tortoise_beak'
      );
    });
  });

  describe('Descriptor validation', () => {
    it('should use valid texture value from descriptors:texture component schema', () => {
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
        beakEntity.components['descriptors:texture'].texture
      );
    });

    it('should use valid shape value from descriptors:shape_general component schema', () => {
      const validShapes = [
        'flat',
        'angular',
        'bulbous',
        'conical',
        'curved',
        'cylindrical',
        'domed',
        'elongated',
        'hooked',
        'oval',
        'round',
        'square',
        'tapered',
      ];

      expect(validShapes).toContain(
        beakEntity.components['descriptors:shape_general'].shape
      );
    });

    it('should use valid color value from descriptors:color_extended component schema', () => {
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
        beakEntity.components['descriptors:color_extended'].color
      );
    });
  });
});
