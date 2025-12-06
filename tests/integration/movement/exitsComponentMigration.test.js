import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Movement:exits Component Migration', () => {
  describe('Component ID Constants', () => {
    it('should reference movement:exits instead of core:exits', async () => {
      // This test will fail until we fix the constants
      const componentIds = await import(
        '../../../src/constants/componentIds.js'
      );

      // After migration, this should be 'movement:exits'
      expect(componentIds.EXITS_COMPONENT_ID).toBe('movement:exits');
    });
  });

  describe('Scope DSL References', () => {
    it('movement scope should reference movement:exits not core:exits', () => {
      const scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );

      if (fs.existsSync(scopePath)) {
        const scopeContent = fs.readFileSync(scopePath, 'utf8');

        // After migration, should use movement:exits
        expect(scopeContent).toContain('movement:exits');
        expect(scopeContent).not.toContain('core:exits');
      }
    });
  });

  describe('Entity Definitions', () => {
    it('p_erotica locations should use movement:exits not core:exits', () => {
      const pEroticaPath = path.resolve(
        process.cwd(),
        'data/mods/p_erotica/entities/definitions/art_museum.location.json'
      );

      if (fs.existsSync(pEroticaPath)) {
        const content = JSON.parse(fs.readFileSync(pEroticaPath, 'utf8'));

        // After migration, should have movement:exits
        expect(content.components['movement:exits']).toBeDefined();
        expect(content.components['core:exits']).toBeUndefined();
      }
    });

    it('isekai locations should use movement:exits not core:exits', () => {
      const isekaiPath = path.resolve(
        process.cwd(),
        'data/mods/isekai/entities/definitions/town.location.json'
      );

      if (fs.existsSync(isekaiPath)) {
        const content = JSON.parse(fs.readFileSync(isekaiPath, 'utf8'));

        // After migration, should have movement:exits
        expect(content.components['movement:exits']).toBeDefined();
        expect(content.components['core:exits']).toBeUndefined();
      }
    });
  });

  describe('Content Dependency Validator', () => {
    it('should look for movement:exits in validateExits method', async () => {
      const ContentDependencyValidator = (
        await import(
          '../../../src/initializers/services/contentDependencyValidator.js'
        )
      ).default;

      // Read the source file to check what it's looking for
      const validatorPath = path.resolve(
        process.cwd(),
        'src/initializers/services/contentDependencyValidator.js'
      );

      if (fs.existsSync(validatorPath)) {
        const sourceCode = fs.readFileSync(validatorPath, 'utf8');

        // After migration, should reference movement:exits
        expect(sourceCode).toContain("'movement:exits'");
        expect(sourceCode).not.toContain("'core:exits'");
      }
    });
  });
});
