import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Arm Entity Validation', () => {
  const armEntity = JSON.parse(
    readFileSync(
      join(process.cwd(), 'data/mods/anatomy/entities/definitions/tortoise_arm.entity.json'),
      'utf-8'
    )
  );

  describe('tortoise_arm entity', () => {
    it('should have correct entity ID', () => {
      expect(armEntity.id).toBe('anatomy:tortoise_arm');
    });

    it('should have correct description', () => {
      expect(armEntity.description).toBe('Scaled reptilian arm with hand socket');
    });

    it('should have anatomy:part component with tortoise_arm subType', () => {
      expect(armEntity.components['anatomy:part']).toBeDefined();
      expect(armEntity.components['anatomy:part'].subType).toBe('tortoise_arm');
    });

    it('should have core:name component with text "arm"', () => {
      expect(armEntity.components['core:name']).toBeDefined();
      expect(armEntity.components['core:name'].text).toBe('arm');
    });

    it('should have descriptors:texture component with "scaled" texture', () => {
      expect(armEntity.components['descriptors:texture']).toBeDefined();
      expect(armEntity.components['descriptors:texture'].texture).toBe('scaled');
    });

    it('should have descriptors:color_extended component with "dark-olive" color', () => {
      expect(armEntity.components['descriptors:color_extended']).toBeDefined();
      expect(armEntity.components['descriptors:color_extended'].color).toBe('dark-olive');
    });
  });

  describe('Socket structure', () => {
    it('should have anatomy:sockets component', () => {
      expect(armEntity.components['anatomy:sockets']).toBeDefined();
      expect(armEntity.components['anatomy:sockets'].sockets).toBeDefined();
    });

    it('should have exactly 1 socket', () => {
      expect(armEntity.components['anatomy:sockets'].sockets).toHaveLength(1);
    });

    it('should have hand socket with correct configuration', () => {
      const handSocket = armEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'hand'
      );

      expect(handSocket).toBeDefined();
      expect(handSocket.allowedTypes).toEqual(['tortoise_hand']);
      expect(handSocket.nameTpl).toBe('{{orientation}} hand');
    });

    it('should have socket ID exactly "hand" (generic, not left/right)', () => {
      const socket = armEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.id).toBe('hand');
    });

    it('should have allowedTypes exactly matching tortoise_hand', () => {
      const socket = armEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.allowedTypes).toEqual(['tortoise_hand']);
      expect(socket.allowedTypes).toHaveLength(1);
    });
  });

  describe('Component structure', () => {
    it('should have exactly 7 components (includes core:weight)', () => {
      const componentKeys = Object.keys(armEntity.components);
      expect(componentKeys.length).toBe(7);
    });

    it('should have all required components', () => {
      expect(armEntity.components['anatomy:part']).toBeDefined();
      expect(armEntity.components['anatomy:part_health']).toBeDefined();
      expect(armEntity.components['anatomy:sockets']).toBeDefined();
      expect(armEntity.components['core:name']).toBeDefined();
      expect(armEntity.components['descriptors:texture']).toBeDefined();
      expect(armEntity.components['descriptors:color_extended']).toBeDefined();
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(armEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have subType matching structure template allowedTypes', () => {
      expect(armEntity.components['anatomy:part'].subType).toBe('tortoise_arm');
    });
  });

  describe('Invariants', () => {
    it('should have exactly one hand socket per arm', () => {
      const sockets = armEntity.components['anatomy:sockets'].sockets;
      expect(sockets).toHaveLength(1);
    });

    it('should use "{{orientation}} hand" nameTpl with orientation token', () => {
      const socket = armEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.nameTpl).toBe('{{orientation}} hand');
      expect(socket.nameTpl).toContain('{{orientation}}');
    });

    it('should have scaled texture as per reptilian anatomy', () => {
      expect(armEntity.components['descriptors:texture'].texture).toBe('scaled');
    });
  });
});
