/**
 * @file Unit tests for Template System Directory Structure
 * @see src/characterBuilder/templates/
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTestBed } from '../../../common/baseTestBed.js';

describe('Template System Directory Structure', () => {
  let testBed;
  const templatesPath = 'src/characterBuilder/templates';

  beforeEach(() => {
    testBed = new BaseTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Directory Structure', () => {
    it('should have the correct directory structure', () => {
      expect(fs.existsSync(templatesPath)).toBe(true);
      expect(fs.existsSync(path.join(templatesPath, 'core'))).toBe(true);
      expect(fs.existsSync(path.join(templatesPath, 'components'))).toBe(true);
      expect(fs.existsSync(path.join(templatesPath, 'utilities'))).toBe(true);
    });

    it('should have required index files', () => {
      expect(fs.existsSync(path.join(templatesPath, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(templatesPath, 'types.js'))).toBe(true);
      expect(fs.existsSync(path.join(templatesPath, 'core/index.js'))).toBe(
        true
      );
      expect(
        fs.existsSync(path.join(templatesPath, 'components/index.js'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(templatesPath, 'utilities/index.js'))
      ).toBe(true);
    });

    it('should have README documentation', () => {
      expect(fs.existsSync(path.join(templatesPath, 'README.md'))).toBe(true);
    });
  });

  describe('Main Index Exports', () => {
    it('should have main index file with exports', () => {
      const mainIndexPath = path.join(templatesPath, 'index.js');
      expect(fs.existsSync(mainIndexPath)).toBe(true);

      const mainIndexContent = fs.readFileSync(mainIndexPath, 'utf8');
      // Check that it exports from subdirectories
      expect(mainIndexContent).toContain("export * from './core/index.js'");
      expect(mainIndexContent).toContain(
        "export * from './components/index.js'"
      );
      expect(mainIndexContent).toContain(
        "export * from './utilities/index.js'"
      );
      // Note: Specific exports will be tested as they're implemented in subsequent tickets
    });

    it('should have proper JSDoc module header', () => {
      const indexContent = fs.readFileSync(
        path.join(templatesPath, 'index.js'),
        'utf8'
      );
      expect(indexContent).toContain('@file HTML Template System main exports');
      expect(indexContent).toContain('@module characterBuilder/templates');
    });
  });

  describe('Type Definitions', () => {
    it('should have valid JSDoc type definitions', () => {
      const typesPath = path.join(templatesPath, 'types.js');
      const typesContent = fs.readFileSync(typesPath, 'utf8');

      // Check for required type definitions
      expect(typesContent).toContain('@typedef {object} PageConfig');
      expect(typesContent).toContain('@typedef {object} PanelConfig');
      expect(typesContent).toContain('@typedef {object} ModalConfig');
      expect(typesContent).toContain('@typedef {object} Action');
      expect(typesContent).toContain('@typedef {object} FooterConfig');
      expect(typesContent).toContain('@typedef {object} FormFieldConfig');
      expect(typesContent).toContain('@typedef {object} TemplateOptions');
      expect(typesContent).toContain('@typedef {object} RenderResult');
    });

    it('should export Types object for IDE support', () => {
      const typesPath = path.join(templatesPath, 'types.js');
      const typesContent = fs.readFileSync(typesPath, 'utf8');

      // Check that it exports a Types object
      expect(typesContent).toContain('export const Types = {}');
    });
  });

  describe('Core Module', () => {
    it('should have core index with expected placeholder exports', () => {
      const coreIndexPath = path.join(templatesPath, 'core/index.js');
      const coreContent = fs.readFileSync(coreIndexPath, 'utf8');

      // Check for expected exports (placeholder for now)
      // Use regex to match both standalone and grouped export syntax
      expect(coreContent).toMatch(
        /export\s*{\s*[^}]*\bcreateCharacterBuilderPage\b[^}]*}/
      );
      expect(coreContent).toMatch(/export\s*{\s*[^}]*\bcreateHeader\b[^}]*}/);
      expect(coreContent).toMatch(/export\s*{\s*[^}]*\bcreateMain\b[^}]*}/);
      expect(coreContent).toMatch(/export\s*{\s*[^}]*\bcreateFooter\b[^}]*}/);
      expect(coreContent).toMatch(/export\s*{\s*[^}]*\bcreateModal\b[^}]*}/);

      // Check for comment about placeholder nature
      expect(coreContent).toContain(
        'NOTE: These exports reference files that will be created in subsequent tickets'
      );
    });
  });

  describe('Components Module', () => {
    it('should have components index with expected placeholder exports', () => {
      const componentsIndexPath = path.join(
        templatesPath,
        'components/index.js'
      );
      const componentsContent = fs.readFileSync(componentsIndexPath, 'utf8');

      // Check for expected exports (placeholder for now)
      expect(componentsContent).toContain('export { createPanel }');
      expect(componentsContent).toContain('export { createFormGroup }');
      expect(componentsContent).toContain('export { createButtonGroup }');
      expect(componentsContent).toContain('export { createDisplayCard }');
      expect(componentsContent).toContain('export { createStatistics }');

      // Check for comment about placeholder nature
      expect(componentsContent).toContain(
        'NOTE: These exports reference files that will be created in subsequent tickets'
      );
    });
  });

  describe('Utilities Module', () => {
    it('should have utilities index with expected placeholder exports', () => {
      const utilitiesIndexPath = path.join(templatesPath, 'utilities/index.js');
      const utilitiesContent = fs.readFileSync(utilitiesIndexPath, 'utf8');

      // Check for expected exports (placeholder for now)
      expect(utilitiesContent).toContain('export { TemplateRenderer }');
      expect(utilitiesContent).toContain('export { TemplateInjector }');
      expect(utilitiesContent).toContain('export { TemplateValidator }');
      expect(utilitiesContent).toContain('export { TemplateCache }');

      // Check for comment about placeholder nature
      expect(utilitiesContent).toContain(
        'NOTE: These exports reference files that will be created in subsequent tickets'
      );
    });
  });

  describe('README Documentation', () => {
    it('should have comprehensive README with usage examples', () => {
      const readmePath = path.join(templatesPath, 'README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf8');

      // Check for required sections
      expect(readmeContent).toContain('# HTML Template System');
      expect(readmeContent).toContain('## Overview');
      expect(readmeContent).toContain('## Structure');
      expect(readmeContent).toContain('## Usage');
      expect(readmeContent).toContain('## Development');

      // Check for usage example
      expect(readmeContent).toContain('createCharacterBuilderPage');
      expect(readmeContent).toContain('TemplateRenderer');

      // Check for development principles
      expect(readmeContent).toContain('Pure functions');
      expect(readmeContent).toContain('Framework-agnostic');
      expect(readmeContent).toContain('accessibility');
    });
  });

  describe('File Conventions', () => {
    it('should follow project naming conventions', () => {
      // Check that all files use camelCase
      const files = [
        'index.js',
        'types.js',
        'core/index.js',
        'components/index.js',
        'utilities/index.js',
      ];

      files.forEach((file) => {
        const filePath = path.join(templatesPath, file);
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify camelCase for file names (excluding index.js)
        const fileName = path.basename(file, '.js');
        if (fileName !== 'index' && fileName !== 'README') {
          expect(fileName[0]).toBe(fileName[0].toLowerCase());
        }
      });
    });

    it('should have proper JSDoc headers in all JavaScript files', () => {
      const jsFiles = [
        'index.js',
        'types.js',
        'core/index.js',
        'components/index.js',
        'utilities/index.js',
      ];

      jsFiles.forEach((file) => {
        const filePath = path.join(templatesPath, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for JSDoc file header
        expect(content).toMatch(/\/\*\*[\s\S]*?@file[\s\S]*?\*\//);
        expect(content).toMatch(/\/\*\*[\s\S]*?@module[\s\S]*?\*\//);
      });
    });
  });
});
