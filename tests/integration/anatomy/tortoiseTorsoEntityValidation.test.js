/**
 * @file Integration test for tortoise_torso_with_shell entity definition
 * Validates TORPERANAREC-003 requirements
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import entityDefinitionSchema from '../../../data/schemas/entity-definition.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import partComponentSchema from '../../../data/mods/anatomy/components/part.component.json';
import socketsComponentSchema from '../../../data/mods/anatomy/components/sockets.component.json';
import nameComponentSchema from '../../../data/mods/core/components/name.component.json';
import textureComponentSchema from '../../../data/mods/descriptors/components/texture.component.json';
import colorExtendedComponentSchema from '../../../data/mods/descriptors/components/color_extended.component.json';

describe('Tortoise Torso Entity Definition (TORPERANAREC-003)', () => {
  let entityDefinition;
  let ajv;

  beforeAll(() => {
    // Load the entity definition file
    const entityPath = join(
      process.cwd(),
      'data/mods/anatomy/entities/definitions/tortoise_torso_with_shell.entity.json'
    );
    const entityContent = readFileSync(entityPath, 'utf-8');
    entityDefinition = JSON.parse(entityContent);

    // Set up AJV with all necessary schemas
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema, commonSchema.$id);
    ajv.addSchema(entityDefinitionSchema, entityDefinitionSchema.$id);
    ajv.addSchema(partComponentSchema.dataSchema, 'anatomy:part');
    ajv.addSchema(socketsComponentSchema.dataSchema, 'anatomy:sockets');
    ajv.addSchema(nameComponentSchema.dataSchema, 'core:name');
    ajv.addSchema(textureComponentSchema.dataSchema, 'descriptors:texture');
    ajv.addSchema(
      colorExtendedComponentSchema.dataSchema,
      'descriptors:color_extended'
    );
  });

  describe('File Structure', () => {
    it('should have correct schema reference', () => {
      expect(entityDefinition.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have correct entity ID', () => {
      expect(entityDefinition.id).toBe('anatomy:tortoise_torso_with_shell');
    });

    it('should have a description', () => {
      expect(entityDefinition.description).toBe(
        'Tortoise torso with integrated shell mounting points'
      );
    });

    it('should validate against entity definition schema', () => {
      const validate = ajv.compile(entityDefinitionSchema);
      const valid = validate(entityDefinition);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('anatomy:part Component', () => {
    it('should have anatomy:part component', () => {
      expect(entityDefinition.components['anatomy:part']).toBeDefined();
    });

    it('should have subType "tortoise_torso"', () => {
      expect(entityDefinition.components['anatomy:part'].subType).toBe(
        'tortoise_torso'
      );
    });

    it('should validate against anatomy:part schema', () => {
      const validate = ajv.compile(partComponentSchema.dataSchema);
      const valid = validate(entityDefinition.components['anatomy:part']);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('anatomy:sockets Component (Shell Mounting Points)', () => {
    it('should have anatomy:sockets component', () => {
      expect(entityDefinition.components['anatomy:sockets']).toBeDefined();
    });

    it('should have exactly 3 sockets', () => {
      expect(
        entityDefinition.components['anatomy:sockets'].sockets
      ).toHaveLength(3);
    });

    it('should have carapace_mount socket with correct configuration', () => {
      const carapaceSocket =
        entityDefinition.components['anatomy:sockets'].sockets.find(
          (s) => s.id === 'carapace_mount'
        );
      expect(carapaceSocket).toBeDefined();
      expect(carapaceSocket.allowedTypes).toEqual(['shell_carapace']);
      expect(carapaceSocket.nameTpl).toBe('upper shell mount');
    });

    it('should have plastron_mount socket with correct configuration', () => {
      const plastronSocket =
        entityDefinition.components['anatomy:sockets'].sockets.find(
          (s) => s.id === 'plastron_mount'
        );
      expect(plastronSocket).toBeDefined();
      expect(plastronSocket.allowedTypes).toEqual(['shell_plastron']);
      expect(plastronSocket.nameTpl).toBe('lower shell mount');
    });

    it('should have torso socket with correct configuration', () => {
      const torsoSocket =
        entityDefinition.components['anatomy:sockets'].sockets.find(
          (s) => s.id === 'torso'
        );
      expect(torsoSocket).toBeDefined();
      expect(torsoSocket.allowedTypes).toEqual(['torso_clothing']);
      expect(torsoSocket.nameTpl).toBe('torso');
    });

    it('should validate against anatomy:sockets schema', () => {
      const validate = ajv.compile(socketsComponentSchema.dataSchema);
      const valid = validate(entityDefinition.components['anatomy:sockets']);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('core:name Component', () => {
    it('should have core:name component', () => {
      expect(entityDefinition.components['core:name']).toBeDefined();
    });

    it('should have text "tortoise torso"', () => {
      expect(entityDefinition.components['core:name'].text).toBe(
        'tortoise torso'
      );
    });

    it('should validate against core:name schema', () => {
      const validate = ajv.compile(nameComponentSchema.dataSchema);
      const valid = validate(entityDefinition.components['core:name']);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('descriptors:texture Component', () => {
    it('should have descriptors:texture component', () => {
      expect(entityDefinition.components['descriptors:texture']).toBeDefined();
    });

    it('should have texture "leathery"', () => {
      expect(entityDefinition.components['descriptors:texture'].texture).toBe(
        'leathery'
      );
    });

    it('should validate against descriptors:texture schema', () => {
      const validate = ajv.compile(textureComponentSchema.dataSchema);
      const valid = validate(
        entityDefinition.components['descriptors:texture']
      );
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('descriptors:color_extended Component', () => {
    it('should have descriptors:color_extended component', () => {
      expect(
        entityDefinition.components['descriptors:color_extended']
      ).toBeDefined();
    });

    it('should have color "dark-olive"', () => {
      expect(
        entityDefinition.components['descriptors:color_extended'].color
      ).toBe('dark-olive');
    });

    it('should validate against descriptors:color_extended schema', () => {
      const validate = ajv.compile(colorExtendedComponentSchema.dataSchema);
      const valid = validate(
        entityDefinition.components['descriptors:color_extended']
      );
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('Invariants (TORPERANAREC-003)', () => {
    it('should have socket IDs matching blueprint expectations', () => {
      const socketIds =
        entityDefinition.components['anatomy:sockets'].sockets.map(
          (s) => s.id
        );
      expect(socketIds).toContain('carapace_mount');
      expect(socketIds).toContain('plastron_mount');
    });

    it('should have socket allowedTypes matching blueprint expectations', () => {
      const carapaceSocket =
        entityDefinition.components['anatomy:sockets'].sockets.find(
          (s) => s.id === 'carapace_mount'
        );
      const plastronSocket =
        entityDefinition.components['anatomy:sockets'].sockets.find(
          (s) => s.id === 'plastron_mount'
        );
      expect(carapaceSocket.allowedTypes).toEqual(['shell_carapace']);
      expect(plastronSocket.allowedTypes).toEqual(['shell_plastron']);
    });

    it('should use valid texture value per schema', () => {
      const validTextures = textureComponentSchema.dataSchema.properties.texture.enum;
      expect(validTextures).toContain(
        entityDefinition.components['descriptors:texture'].texture
      );
    });

    it('should use valid color value per schema', () => {
      const validColors =
        colorExtendedComponentSchema.dataSchema.properties.color.enum;
      expect(validColors).toContain(
        entityDefinition.components['descriptors:color_extended'].color
      );
    });

    it('should have unique subType value', () => {
      expect(entityDefinition.components['anatomy:part'].subType).toBe(
        'tortoise_torso'
      );
    });
  });
});
