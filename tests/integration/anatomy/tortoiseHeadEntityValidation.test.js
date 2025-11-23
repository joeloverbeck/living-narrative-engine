import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Head Entity Validation', () => {
  const headEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_head.entity.json'),
      'utf-8'
    )
  );

  describe('tortoise_head entity', () => {
    it('should have correct entity ID', () => {
      expect(headEntity.id).toBe('anatomy:tortoise_head');
    });

    it('should have correct description', () => {
      expect(headEntity.description).toBe('Reptilian head with beak mount and eye sockets');
    });

    it('should have anatomy:part component with tortoise_head subType', () => {
      expect(headEntity.components['anatomy:part']).toBeDefined();
      expect(headEntity.components['anatomy:part'].subType).toBe('tortoise_head');
    });

    it('should have core:name component with text "tortoise head"', () => {
      expect(headEntity.components['core:name']).toBeDefined();
      expect(headEntity.components['core:name'].text).toBe('tortoise head');
    });

    it('should have descriptors:texture component with "scaled" texture', () => {
      expect(headEntity.components['descriptors:texture']).toBeDefined();
      expect(headEntity.components['descriptors:texture'].texture).toBe('scaled');
    });

    it('should have descriptors:shape_general component with "domed" shape', () => {
      expect(headEntity.components['descriptors:shape_general']).toBeDefined();
      expect(headEntity.components['descriptors:shape_general'].shape).toBe('domed');
    });

    it('should have descriptors:color_extended component with "sickly-gray-green" color', () => {
      expect(headEntity.components['descriptors:color_extended']).toBeDefined();
      expect(headEntity.components['descriptors:color_extended'].color).toBe('sickly-gray-green');
    });
  });

  describe('Socket structure', () => {
    it('should have anatomy:sockets component', () => {
      expect(headEntity.components['anatomy:sockets']).toBeDefined();
      expect(headEntity.components['anatomy:sockets'].sockets).toBeDefined();
    });

    it('should have exactly 3 sockets', () => {
      expect(headEntity.components['anatomy:sockets'].sockets).toHaveLength(3);
    });

    it('should have left_eye socket with correct configuration', () => {
      const leftEye = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'left_eye'
      );

      expect(leftEye).toBeDefined();
      expect(leftEye.allowedTypes).toEqual(['tortoise_eye']);
      expect(leftEye.nameTpl).toBe('left eye');
    });

    it('should have right_eye socket with correct configuration', () => {
      const rightEye = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'right_eye'
      );

      expect(rightEye).toBeDefined();
      expect(rightEye.allowedTypes).toEqual(['tortoise_eye']);
      expect(rightEye.nameTpl).toBe('right eye');
    });

    it('should have beak_mount socket with correct configuration', () => {
      const beakMount = headEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'beak_mount'
      );

      expect(beakMount).toBeDefined();
      expect(beakMount.allowedTypes).toEqual(['tortoise_beak']);
      expect(beakMount.nameTpl).toBe('beak');
    });
  });

  describe('Component structure', () => {
    it('should have exactly 6 components', () => {
      const componentKeys = Object.keys(headEntity.components);
      expect(componentKeys.length).toBe(6);
    });

    it('should have all required components', () => {
      expect(headEntity.components['anatomy:part']).toBeDefined();
      expect(headEntity.components['anatomy:sockets']).toBeDefined();
      expect(headEntity.components['core:name']).toBeDefined();
      expect(headEntity.components['descriptors:texture']).toBeDefined();
      expect(headEntity.components['descriptors:shape_general']).toBeDefined();
      expect(headEntity.components['descriptors:color_extended']).toBeDefined();
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(headEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have unique subType for tortoise head', () => {
      expect(headEntity.components['anatomy:part'].subType).toBe('tortoise_head');
    });
  });
});
