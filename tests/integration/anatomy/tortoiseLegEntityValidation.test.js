import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tortoise Leg Entity Validation', () => {
  const legEntity = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'data/mods/anatomy/entities/definitions/tortoise_leg.entity.json'
      ),
      'utf-8'
    )
  );

  describe('tortoise_leg entity', () => {
    it('should have correct entity ID', () => {
      expect(legEntity.id).toBe('anatomy:tortoise_leg');
    });

    it('should have correct description', () => {
      expect(legEntity.description).toBe(
        'Sturdy reptilian leg with foot socket'
      );
    });

    it('should have anatomy:part component with tortoise_leg subType', () => {
      expect(legEntity.components['anatomy:part']).toBeDefined();
      expect(legEntity.components['anatomy:part'].subType).toBe('tortoise_leg');
    });

    it('should have core:name component with text "leg"', () => {
      expect(legEntity.components['core:name']).toBeDefined();
      expect(legEntity.components['core:name'].text).toBe('leg');
    });

    it('should have descriptors:texture component with "scaled" texture', () => {
      expect(legEntity.components['descriptors:texture']).toBeDefined();
      expect(legEntity.components['descriptors:texture'].texture).toBe(
        'scaled'
      );
    });

    it('should have descriptors:build component with "stocky" build', () => {
      expect(legEntity.components['descriptors:build']).toBeDefined();
      expect(legEntity.components['descriptors:build'].build).toBe('stocky');
    });

    it('should have descriptors:color_extended component with "dark-olive" color', () => {
      expect(legEntity.components['descriptors:color_extended']).toBeDefined();
      expect(legEntity.components['descriptors:color_extended'].color).toBe(
        'dark-olive'
      );
    });
  });

  describe('Socket structure', () => {
    it('should have anatomy:sockets component', () => {
      expect(legEntity.components['anatomy:sockets']).toBeDefined();
      expect(legEntity.components['anatomy:sockets'].sockets).toBeDefined();
    });

    it('should have exactly 1 socket', () => {
      expect(legEntity.components['anatomy:sockets'].sockets).toHaveLength(1);
    });

    it('should have foot socket with correct configuration', () => {
      const footSocket = legEntity.components['anatomy:sockets'].sockets.find(
        (s) => s.id === 'foot'
      );

      expect(footSocket).toBeDefined();
      expect(footSocket.allowedTypes).toEqual(['tortoise_foot']);
      expect(footSocket.nameTpl).toBe('{{orientation}} foot');
    });

    it('should have socket ID exactly "foot" (generic, not left/right)', () => {
      const socket = legEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.id).toBe('foot');
    });

    it('should have allowedTypes exactly matching tortoise_foot', () => {
      const socket = legEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.allowedTypes).toEqual(['tortoise_foot']);
      expect(socket.allowedTypes).toHaveLength(1);
    });
  });

  describe('Component structure', () => {
    it('should have exactly 9 components (includes core:weight)', () => {
      const componentKeys = Object.keys(legEntity.components);
      expect(componentKeys.length).toBe(9);
    });

    it('should have all required components', () => {
      expect(legEntity.components['anatomy:part']).toBeDefined();
      expect(legEntity.components['anatomy:part_health']).toBeDefined();
      expect(legEntity.components['anatomy:sockets']).toBeDefined();
      expect(legEntity.components['core:name']).toBeDefined();
      expect(legEntity.components['descriptors:texture']).toBeDefined();
      expect(legEntity.components['descriptors:build']).toBeDefined();
      expect(legEntity.components['descriptors:color_extended']).toBeDefined();
      expect(legEntity.components['core:movement']).toBeDefined();
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(legEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have subType matching structure template allowedTypes', () => {
      expect(legEntity.components['anatomy:part'].subType).toBe('tortoise_leg');
    });
  });

  describe('Invariants', () => {
    it('should have exactly one foot socket per leg', () => {
      const sockets = legEntity.components['anatomy:sockets'].sockets;
      expect(sockets).toHaveLength(1);
    });

    it('should use "{{orientation}} foot" nameTpl with orientation token', () => {
      const socket = legEntity.components['anatomy:sockets'].sockets[0];
      expect(socket.nameTpl).toBe('{{orientation}} foot');
      expect(socket.nameTpl).toContain('{{orientation}}');
    });

    it('should have scaled texture as per reptilian anatomy', () => {
      expect(legEntity.components['descriptors:texture'].texture).toBe(
        'scaled'
      );
    });

    it('should have stocky build as per tortoise physique', () => {
      expect(legEntity.components['descriptors:build'].build).toBe('stocky');
    });
  });

  describe('Build descriptor validation', () => {
    it('should use valid build enumeration value', () => {
      const validBuilds = [
        'skinny',
        'slim',
        'lissom',
        'toned',
        'athletic',
        'shapely',
        'hourglass',
        'thick',
        'muscular',
        'hulking',
        'stocky',
        'frail',
        'gaunt',
        'skeletal',
        'atrophied',
        'cadaverous',
        'massive',
        'willowy',
        'barrel-chested',
        'lanky',
        'working-strength',
      ];
      const build = legEntity.components['descriptors:build'].build;
      expect(validBuilds).toContain(build);
    });

    it('should match Body Descriptor Registry specification for stocky', () => {
      expect(legEntity.components['descriptors:build'].build).toBe('stocky');
    });
  });
});
