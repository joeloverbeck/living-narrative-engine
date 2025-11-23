import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Eye Entity Validation', () => {
  const eyeEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_eye.entity.json'),
      'utf-8'
    )
  );

  describe('tortoise_eye entity', () => {
    it('should have correct entity ID', () => {
      expect(eyeEntity.id).toBe('anatomy:tortoise_eye');
    });

    it('should have correct description', () => {
      expect(eyeEntity.description).toBe('Reptilian eye with protective nictitating membrane');
    });

    it('should have anatomy:part component with tortoise_eye subType', () => {
      expect(eyeEntity.components['anatomy:part']).toBeDefined();
      expect(eyeEntity.components['anatomy:part'].subType).toBe('tortoise_eye');
    });

    it('should have core:name component with text "eye"', () => {
      expect(eyeEntity.components['core:name']).toBeDefined();
      expect(eyeEntity.components['core:name'].text).toBe('eye');
    });

    it('should have descriptors:color_extended component with "amber" color', () => {
      expect(eyeEntity.components['descriptors:color_extended']).toBeDefined();
      expect(eyeEntity.components['descriptors:color_extended'].color).toBe('amber');
    });

    it('should have descriptors:shape_eye component with "round" shape', () => {
      expect(eyeEntity.components['descriptors:shape_eye']).toBeDefined();
      expect(eyeEntity.components['descriptors:shape_eye'].shape).toBe('round');
    });

    it('should NOT have descriptors:shape_general component', () => {
      expect(eyeEntity.components['descriptors:shape_general']).toBeUndefined();
    });
  });

  describe('Component structure', () => {
    it('should have exactly 4 components', () => {
      const componentKeys = Object.keys(eyeEntity.components);
      expect(componentKeys.length).toBe(4);
    });

    it('should have all required components', () => {
      expect(eyeEntity.components['anatomy:part']).toBeDefined();
      expect(eyeEntity.components['core:name']).toBeDefined();
      expect(eyeEntity.components['descriptors:color_extended']).toBeDefined();
      expect(eyeEntity.components['descriptors:shape_eye']).toBeDefined();
    });

    it('should not have anatomy:sockets component (mounted part)', () => {
      expect(eyeEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should not have descriptors:texture component', () => {
      expect(eyeEntity.components['descriptors:texture']).toBeUndefined();
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(eyeEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have unique subType for tortoise eye', () => {
      expect(eyeEntity.components['anatomy:part'].subType).toBe('tortoise_eye');
    });
  });

  describe('Socket compatibility', () => {
    it('should have subType that matches head eye socket allowedTypes', () => {
      const headEntity = JSON.parse(
        readFileSync(
          join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_head.entity.json'),
          'utf-8'
        )
      );
      
      const leftEyeSocket = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'left_eye'
      );
      const rightEyeSocket = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'right_eye'
      );

      expect(leftEyeSocket).toBeDefined();
      expect(rightEyeSocket).toBeDefined();
      expect(leftEyeSocket.allowedTypes).toContain('tortoise_eye');
      expect(rightEyeSocket.allowedTypes).toContain('tortoise_eye');
      expect(eyeEntity.components['anatomy:part'].subType).toBe('tortoise_eye');
    });
  });

  describe('Descriptor validation', () => {
    it('should use valid shape value from descriptors:shape_eye component schema', () => {
      const validEyeShapes = [
        'round', 'almond', 'hooded', 'monolid', 'downturned', 'upturned'
      ];
      
      expect(validEyeShapes).toContain(eyeEntity.components['descriptors:shape_eye'].shape);
    });

    it('should use valid color value from descriptors:color_extended component schema', () => {
      const validColors = [
        'abyssal-black', 'amber', 'auburn', 'blood-red', 'blonde', 'blush-pink',
        'bronze', 'brown-grey-mixed', 'brunette', 'charcoal-gray', 'cobalt',
        'corpse-pale', 'cream', 'crimson', 'dark-olive', 'dark-purple',
        'deep-crimson', 'deep-navy', 'gold', 'hazel', 'indigo',
        'iridescent-blue-green', 'iridescent-green', 'midnight-blue',
        'mottled-gray', 'mottled-purple-gray', 'murky-green', 'navy', 'nude',
        'pale-blue', 'ice-blue', 'pale-pink', 'pale-pink-internal-organs-visible',
        'pale-translucent', 'pearl-white', 'powder-pink', 'pupil-less-amber',
        'raven-black', 'reddish-brown', 'sand-beige', 'sickly-gray-green',
        'silver', 'smoke-black', 'tan-brown', 'taupe', 'translucent-white',
        'varied-human-colors', 'violet', 'warm-brown'
      ];
      
      expect(validColors).toContain(eyeEntity.components['descriptors:color_extended'].color);
    });
  });

  describe('Eye-specific component usage', () => {
    it('should use shape_eye component instead of shape_general', () => {
      expect(eyeEntity.components['descriptors:shape_eye']).toBeDefined();
      expect(eyeEntity.components['descriptors:shape_general']).toBeUndefined();
    });
  });
});
