import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Movement Scopes', () => {
  describe('Clear Directions Scope', () => {
    let scopeContent;
    let scopePath;

    beforeEach(() => {
      scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );
      scopeContent = fs.readFileSync(scopePath, 'utf8');
    });

    it('should exist and have content', () => {
      expect(scopeContent).toBeDefined();
      expect(scopeContent.length).toBeGreaterThan(0);
    });

    it('should contain expected scope DSL patterns', () => {
      // Verify scope contains expected patterns
      // The scope uses location.locations:exits pattern
      expect(scopeContent).toMatch(/location\.locations:exits/);
    });

    it('should use correct component references', () => {
      // Check for component namespacing if used
      // Movement scopes typically reference exits and location components
      const hasExitsReference = scopeContent.includes('exits');
      const hasLocationReference = scopeContent.includes('location');
      const hasComponentNamespace = scopeContent.includes(':');

      // At least one of these patterns should be present
      expect(
        hasExitsReference || hasLocationReference || hasComponentNamespace
      ).toBe(true);
    });

    it('should follow scope DSL syntax rules', () => {
      // Check for valid scope DSL operators
      const validOperators = [
        '.', // Field access
        '[]', // Array iteration
        '+', // Union operator
        '|', // Alternative union operator
        ':', // Component namespace
      ];

      // Verify the scope uses at least some valid operators
      const usesFieldAccess = scopeContent.includes('.');
      const usesArrayIteration = scopeContent.includes('[]');
      const hasValidSyntax = usesFieldAccess || usesArrayIteration;

      expect(hasValidSyntax).toBe(true);
    });

    it('should not contain invalid characters', () => {
      // Scope files should not contain certain invalid characters
      expect(scopeContent).not.toMatch(/[<>]/); // No HTML-like tags
      expect(scopeContent).not.toMatch(/\${/); // No template literals
      expect(scopeContent).not.toMatch(/function|class|const|let|var/); // No JS keywords
    });

    it('should be properly formatted', () => {
      // Check that the scope is not just whitespace
      const trimmedContent = scopeContent.trim();
      expect(trimmedContent.length).toBeGreaterThan(0);

      // Check that it doesn't have excessive whitespace (ignoring indentation)
      // The scope has indentation for JSON structure which is valid
      const lines = scopeContent.split('\n');
      const hasValidFormatting = lines.every((line) => {
        // Allow indentation at start of line
        const trimmedLine = line.trimStart();
        // Check for excessive spaces within the line (not at start)
        return !/\s{5,}/.test(trimmedLine);
      });
      expect(hasValidFormatting).toBe(true);
    });

    it('should reference movement-related entities', () => {
      // Movement scopes should reference entities relevant to movement
      const referencesLocation = scopeContent.includes('location');
      const referencesExits = scopeContent.includes('exits');
      const referencesTarget = scopeContent.includes('target');
      const referencesMovement = scopeContent.includes('movement:');

      // At least one of these should be present for a movement scope
      const hasMovementReferences =
        referencesLocation ||
        referencesExits ||
        referencesTarget ||
        referencesMovement;

      expect(hasMovementReferences).toBe(true);
    });
  });

  describe('Movement Scopes Directory', () => {
    let scopesDir;

    beforeEach(() => {
      scopesDir = path.resolve(process.cwd(), 'data/mods/movement/scopes');
    });

    it('should exist', () => {
      expect(fs.existsSync(scopesDir)).toBe(true);
    });

    it('should contain scope files', () => {
      const scopeFiles = fs
        .readdirSync(scopesDir)
        .filter((file) => file.endsWith('.scope'));

      expect(scopeFiles.length).toBeGreaterThan(0);
      expect(scopeFiles).toContain('clear_directions.scope');
    });

    it('should have all scope files be readable', () => {
      const scopeFiles = fs
        .readdirSync(scopesDir)
        .filter((file) => file.endsWith('.scope'));

      scopeFiles.forEach((file) => {
        const filePath = path.join(scopesDir, file);

        // Should be able to read the file without throwing
        expect(() => {
          fs.readFileSync(filePath, 'utf8');
        }).not.toThrow();

        // File should have content
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(0);
      });
    });

    it('should follow naming conventions', () => {
      const scopeFiles = fs
        .readdirSync(scopesDir)
        .filter((file) => file.endsWith('.scope'));

      scopeFiles.forEach((file) => {
        // Scope files should use snake_case naming
        const baseName = file.replace('.scope', '');
        const isSnakeCase = /^[a-z]+(_[a-z]+)*$/.test(baseName);
        expect(isSnakeCase).toBe(true);
      });
    });
  });

  describe('Scope Cross-References', () => {
    it('should have scopes referenced by movement actions', () => {
      // Load the go action to verify it references the scope
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Verify the action references our scope
      expect(action.targets.primary.scope).toBe('movement:clear_directions');

      // Verify the referenced scope file exists
      const scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );
      expect(fs.existsSync(scopePath)).toBe(true);
    });
  });
});
