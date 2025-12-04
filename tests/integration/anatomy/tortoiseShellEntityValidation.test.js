import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Shell Entity Validation', () => {
  const carapaceEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_carapace.entity.json'),
      'utf-8'
    )
  );

  const plastronEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_plastron.entity.json'),
      'utf-8'
    )
  );

  const torsoEntity = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'data/mods/anatomy/entities/definitions/tortoise_torso_with_shell.entity.json'
      ),
      'utf-8'
    )
  );

  describe('tortoise_carapace entity', () => {
    it('should have correct entity ID', () => {
      expect(carapaceEntity.id).toBe('anatomy:tortoise_carapace');
    });

    it('should have correct description', () => {
      expect(carapaceEntity.description).toBe('Domed upper shell (carapace) with growth rings');
    });

    it('should have anatomy:part component with shell_carapace subType', () => {
      expect(carapaceEntity.components['anatomy:part']).toBeDefined();
      expect(carapaceEntity.components['anatomy:part'].subType).toBe('shell_carapace');
    });

    it('should have core:name component with text "carapace"', () => {
      expect(carapaceEntity.components['core:name']).toBeDefined();
      expect(carapaceEntity.components['core:name'].text).toBe('carapace');
    });

    it('should have descriptors:texture component with "scaled" texture', () => {
      expect(carapaceEntity.components['descriptors:texture']).toBeDefined();
      expect(carapaceEntity.components['descriptors:texture'].texture).toBe('scaled');
    });

    it('should have descriptors:pattern component with "hexagonal-scutes" pattern', () => {
      expect(carapaceEntity.components['descriptors:pattern']).toBeDefined();
      expect(carapaceEntity.components['descriptors:pattern'].pattern).toBe('hexagonal-scutes');
    });

    it('should have descriptors:color_extended component with "bronze" color', () => {
      expect(carapaceEntity.components['descriptors:color_extended']).toBeDefined();
      expect(carapaceEntity.components['descriptors:color_extended'].color).toBe('bronze');
    });

    it('should have descriptors:shape_general component with "domed" shape', () => {
      expect(carapaceEntity.components['descriptors:shape_general']).toBeDefined();
      expect(carapaceEntity.components['descriptors:shape_general'].shape).toBe('domed');
    });

    it('should match socket requirements in tortoise_torso_with_shell', () => {
      const carapaceSocket = torsoEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'carapace_mount'
      );
      const carapaceSubType = carapaceEntity.components['anatomy:part'].subType;

      expect(carapaceSocket).toBeDefined();
      expect(carapaceSocket.allowedTypes).toContain(carapaceSubType);
    });
  });

  describe('tortoise_plastron entity', () => {
    it('should have correct entity ID', () => {
      expect(plastronEntity.id).toBe('anatomy:tortoise_plastron');
    });

    it('should have correct description', () => {
      expect(plastronEntity.description).toBe('Flat lower shell (plastron) protecting underside');
    });

    it('should have anatomy:part component with shell_plastron subType', () => {
      expect(plastronEntity.components['anatomy:part']).toBeDefined();
      expect(plastronEntity.components['anatomy:part'].subType).toBe('shell_plastron');
    });

    it('should have core:name component with text "plastron"', () => {
      expect(plastronEntity.components['core:name']).toBeDefined();
      expect(plastronEntity.components['core:name'].text).toBe('plastron');
    });

    it('should have descriptors:texture component with "smooth" texture', () => {
      expect(plastronEntity.components['descriptors:texture']).toBeDefined();
      expect(plastronEntity.components['descriptors:texture'].texture).toBe('smooth');
    });

    it('should have descriptors:color_extended component with "cream" color', () => {
      expect(plastronEntity.components['descriptors:color_extended']).toBeDefined();
      expect(plastronEntity.components['descriptors:color_extended'].color).toBe('cream');
    });

    it('should have descriptors:shape_general component with "flat" shape', () => {
      expect(plastronEntity.components['descriptors:shape_general']).toBeDefined();
      expect(plastronEntity.components['descriptors:shape_general'].shape).toBe('flat');
    });

    it('should match socket requirements in tortoise_torso_with_shell', () => {
      const plastronSocket = torsoEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'plastron_mount'
      );
      const plastronSubType = plastronEntity.components['anatomy:part'].subType;

      expect(plastronSocket).toBeDefined();
      expect(plastronSocket.allowedTypes).toContain(plastronSubType);
    });
  });

  describe('Structural consistency', () => {
    it('carapace should have 8 components while plastron has 7 (including items:weight)', () => {
      const carapaceKeys = Object.keys(carapaceEntity.components);
      const plastronKeys = Object.keys(plastronEntity.components);

      expect(carapaceKeys.length).toBe(8);
      expect(plastronKeys.length).toBe(7);
    });

    it('carapace should have pattern component that plastron lacks', () => {
      expect(carapaceEntity.components['descriptors:pattern']).toBeDefined();
      expect(plastronEntity.components['descriptors:pattern']).toBeUndefined();
    });

    it('both entities should have common core components', () => {
      // Both have anatomy:part
      expect(carapaceEntity.components['anatomy:part']).toBeDefined();
      expect(plastronEntity.components['anatomy:part']).toBeDefined();

      // Both have anatomy:part_health
      expect(carapaceEntity.components['anatomy:part_health']).toBeDefined();
      expect(plastronEntity.components['anatomy:part_health']).toBeDefined();

      // Both have core:name
      expect(carapaceEntity.components['core:name']).toBeDefined();
      expect(plastronEntity.components['core:name']).toBeDefined();

      // Both have descriptors:texture
      expect(carapaceEntity.components['descriptors:texture']).toBeDefined();
      expect(plastronEntity.components['descriptors:texture']).toBeDefined();

      // Both have descriptors:color_extended
      expect(carapaceEntity.components['descriptors:color_extended']).toBeDefined();
      expect(plastronEntity.components['descriptors:color_extended']).toBeDefined();

      // Both have descriptors:shape_general
      expect(carapaceEntity.components['descriptors:shape_general']).toBeDefined();
      expect(plastronEntity.components['descriptors:shape_general']).toBeDefined();
    });

    it('entities should differ in subType, color, texture, and shape', () => {
      // Different subTypes
      expect(carapaceEntity.components['anatomy:part'].subType).toBe('shell_carapace');
      expect(plastronEntity.components['anatomy:part'].subType).toBe('shell_plastron');

      // Different colors
      expect(carapaceEntity.components['descriptors:color_extended'].color).toBe('bronze');
      expect(plastronEntity.components['descriptors:color_extended'].color).toBe('cream');

      // Different textures
      expect(carapaceEntity.components['descriptors:texture'].texture).toBe('scaled');
      expect(plastronEntity.components['descriptors:texture'].texture).toBe('smooth');

      // Different shapes
      expect(carapaceEntity.components['descriptors:shape_general'].shape).toBe('domed');
      expect(plastronEntity.components['descriptors:shape_general'].shape).toBe('flat');
    });
  });
});
