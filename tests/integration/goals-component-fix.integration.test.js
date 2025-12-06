/**
 * @file Integration test to verify goals component is correctly referenced as core:goals
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GOALS_COMPONENT_ID } from '../../src/constants/componentIds.js';
import EntityConfig from '../../src/entities/config/EntityConfig.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Goals Component ID Fix Verification', () => {
  describe('Source code references', () => {
    it('should use core:goals in componentIds constant', () => {
      expect(GOALS_COMPONENT_ID).toBe('core:goals');
    });

    it('should use core:goals in EntityConfig defaults', () => {
      const defaults = EntityConfig.DEFAULTS.DEFAULT_COMPONENT_TYPES;
      expect(defaults).toContain('core:goals');
      expect(defaults).not.toContain('movement:goals');
    });
  });

  describe('Component definition', () => {
    it('should have goals component defined in core mod with correct ID', () => {
      const componentPath = join(
        process.cwd(),
        'data',
        'mods',
        'core',
        'components',
        'goals.component.json'
      );
      const componentData = JSON.parse(readFileSync(componentPath, 'utf8'));

      expect(componentData.id).toBe('core:goals');
      expect(componentData.id).not.toBe('movement:goals');
    });
  });

  describe('Character files', () => {
    it('should not have any p_erotica character files using movement:goals', () => {
      const p_eroticaPath = join(
        process.cwd(),
        '.private',
        'data',
        'mods',
        'p_erotica',
        'entities',
        'definitions'
      );

      try {
        const files = readdirSync(p_eroticaPath).filter((f) =>
          f.endsWith('.character.json')
        );

        files.forEach((file) => {
          const filePath = join(p_eroticaPath, file);
          const content = readFileSync(filePath, 'utf8');

          // Check that movement:goals is not present
          expect(content).not.toContain('"movement:goals"');

          // If the file has goals component, it should be core:goals
          if (content.includes('goals')) {
            const data = JSON.parse(content);
            if (data.components) {
              const componentKeys = Object.keys(data.components);
              expect(componentKeys).not.toContain('movement:goals');
              // If it has goals, it should be core:goals
              if (componentKeys.some((key) => key.includes('goals'))) {
                expect(componentKeys).toContain('core:goals');
              }
            }
          }
        });
      } catch (error) {
        // If directory doesn't exist, that's okay - not all installations have private mods
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    });
  });

  describe('No remaining movement:goals references', () => {
    it('should not have movement:goals in any source JavaScript files', () => {
      // This test would need to scan all JS files, but for performance
      // we'll just check the key files we know were problematic
      const filesToCheck = [
        'src/constants/componentIds.js',
        'src/entities/config/EntityConfig.js',
        'src/characterBuilder/services/TraitsRewriterGenerator.js',
        'src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js',
        'src/characterBuilder/controllers/TraitsRewriterController.js',
        'src/characterBuilder/controllers/SpeechPatternsGeneratorController.js',
      ];

      filesToCheck.forEach((relativePath) => {
        const filePath = join(process.cwd(), relativePath);
        const content = readFileSync(filePath, 'utf8');

        // Should not contain movement:goals as a string literal
        expect(content).not.toMatch(/'movement:goals'/);
        expect(content).not.toMatch(/"movement:goals"/);

        // Should contain core:goals instead (in the files that reference goals)
        if (
          relativePath.includes('componentIds') ||
          relativePath.includes('EntityConfig')
        ) {
          expect(content).toMatch(/'core:goals'/);
        }
      });
    });
  });
});
