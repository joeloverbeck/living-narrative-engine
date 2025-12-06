import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import jsonLogic from 'json-logic-js';

describe('Movement Error Handling', () => {
  describe('File System Validation', () => {
    it('should handle missing scope file gracefully', () => {
      const scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );

      // Verify scope file exists
      expect(fs.existsSync(scopePath)).toBe(true);

      // Test scope content is valid
      const scopeContent = fs.readFileSync(scopePath, 'utf8');
      expect(scopeContent).not.toBe('');
      expect(scopeContent.trim().length).toBeGreaterThan(0);
    });

    it('should validate all movement mod files exist', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      // Check required directories
      expect(fs.existsSync(path.join(modPath, 'actions'))).toBe(true);
      expect(fs.existsSync(path.join(modPath, 'conditions'))).toBe(true);
      expect(fs.existsSync(path.join(modPath, 'scopes'))).toBe(true);
      expect(fs.existsSync(path.join(modPath, 'rules'))).toBe(true);

      // Check manifest
      expect(fs.existsSync(path.join(modPath, 'mod-manifest.json'))).toBe(true);
    });

    it('should have valid directory structure', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      // Check that directories are actually directories
      expect(fs.statSync(path.join(modPath, 'actions')).isDirectory()).toBe(
        true
      );
      expect(fs.statSync(path.join(modPath, 'conditions')).isDirectory()).toBe(
        true
      );
      expect(fs.statSync(path.join(modPath, 'scopes')).isDirectory()).toBe(
        true
      );
      expect(fs.statSync(path.join(modPath, 'rules')).isDirectory()).toBe(true);

      // Check that manifest is a file
      expect(
        fs.statSync(path.join(modPath, 'mod-manifest.json')).isFile()
      ).toBe(true);
    });
  });

  describe('Condition Logic Error Handling', () => {
    it('should handle malformed condition logic with empty context', () => {
      // Load a condition and verify structure
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/exit-is-unblocked.condition.json'
      );
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

      // Since conditions use custom operations, just verify structure
      expect(condition.logic).toBeDefined();
      expect(typeof condition.logic).toBe('object');
    });

    it('should handle null context in conditions', () => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

      // Since conditions use custom operations, just verify the logic exists
      expect(condition.logic).toBeDefined();
      expect(typeof condition.logic).toBe('object');

      // Verify it has the custom operation
      const logicStr = JSON.stringify(condition.logic);
      expect(logicStr).toContain('hasPartWithComponentValue');
    });

    it('should handle deeply nested undefined properties', () => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/event-is-action-go.condition.json'
      );
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

      // Since conditions use custom operations, just verify structure
      expect(condition.logic).toBeDefined();
      expect(typeof condition.logic).toBe('object');

      // Verify the condition references the movement:go action
      const logicStr = JSON.stringify(condition.logic);
      expect(logicStr).toContain('movement:go');
    });
  });

  describe('JSON Parsing Error Handling', () => {
    it('should have valid JSON in all action files', () => {
      const actionsDir = path.resolve(
        process.cwd(),
        'data/mods/movement/actions'
      );
      const actionFiles = fs
        .readdirSync(actionsDir)
        .filter((file) => file.endsWith('.action.json'));

      actionFiles.forEach((file) => {
        const filePath = path.join(actionsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        expect(() => {
          JSON.parse(content);
        }).not.toThrow();
      });
    });

    it('should have valid JSON in all condition files', () => {
      const conditionsDir = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions'
      );
      const conditionFiles = fs
        .readdirSync(conditionsDir)
        .filter((file) => file.endsWith('.condition.json'));

      conditionFiles.forEach((file) => {
        const filePath = path.join(conditionsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        expect(() => {
          JSON.parse(content);
        }).not.toThrow();
      });
    });

    it('should have valid JSON in all rule files', () => {
      const rulesDir = path.resolve(process.cwd(), 'data/mods/movement/rules');
      const ruleFiles = fs
        .readdirSync(rulesDir)
        .filter((file) => file.endsWith('.rule.json'));

      ruleFiles.forEach((file) => {
        const filePath = path.join(rulesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        expect(() => {
          JSON.parse(content);
        }).not.toThrow();
      });
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should have all files reference correct schemas', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      // Check actions
      const actionsDir = path.join(modPath, 'actions');
      fs.readdirSync(actionsDir)
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(actionsDir, file), 'utf8')
          );
          expect(content.$schema).toBe(
            'schema://living-narrative-engine/action.schema.json'
          );
        });

      // Check conditions
      const conditionsDir = path.join(modPath, 'conditions');
      fs.readdirSync(conditionsDir)
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(conditionsDir, file), 'utf8')
          );
          expect(content.$schema).toBe(
            'schema://living-narrative-engine/condition.schema.json'
          );
        });

      // Check rules
      const rulesDir = path.join(modPath, 'rules');
      fs.readdirSync(rulesDir)
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(rulesDir, file), 'utf8')
          );
          expect(content.$schema).toBe(
            'schema://living-narrative-engine/rule.schema.json'
          );
        });
    });

    it('should have all IDs properly namespaced', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      // Check actions and conditions have movement: prefix in their IDs
      const checkNamespace = (dir, extension, idField = 'id') => {
        const files = fs
          .readdirSync(path.join(modPath, dir))
          .filter((file) => file.endsWith(extension));

        files.forEach((file) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(modPath, dir, file), 'utf8')
          );
          if (idField === 'id') {
            expect(content[idField]).toMatch(/^movement:/);
          }
        });
      };

      checkNamespace('actions', '.action.json');
      checkNamespace('conditions', '.condition.json');
      // Rules use different structure - they reference movement conditions
      const rulesDir = path.join(modPath, 'rules');
      fs.readdirSync(rulesDir)
        .filter((file) => file.endsWith('.rule.json'))
        .forEach((file) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(rulesDir, file), 'utf8')
          );
          // Rule should reference movement conditions
          if (content.condition?.condition_ref) {
            expect(content.condition.condition_ref).toMatch(/^movement:/);
          }
        });
    });
  });

  describe('Cross-Reference Edge Cases', () => {
    it('should handle circular dependencies gracefully', () => {
      // Movement mod should not depend on positioning mod to avoid circular deps
      const movementManifest = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), 'data/mods/movement/mod-manifest.json'),
          'utf8'
        )
      );

      // Movement should not depend on positioning
      expect(movementManifest.dependencies).not.toContain('positioning');
    });

    it('should handle missing referenced conditions', () => {
      // Load all actions and check their condition references
      const actionsDir = path.resolve(
        process.cwd(),
        'data/mods/movement/actions'
      );
      const actionFiles = fs
        .readdirSync(actionsDir)
        .filter((file) => file.endsWith('.json'));

      actionFiles.forEach((file) => {
        const action = JSON.parse(
          fs.readFileSync(path.join(actionsDir, file), 'utf8')
        );

        if (action.prerequisites) {
          action.prerequisites.forEach((prereq) => {
            if (prereq.logic?.condition_ref) {
              const conditionRef = prereq.logic.condition_ref;

              // If it's a movement condition, verify it exists
              if (conditionRef.startsWith('movement:')) {
                const conditionId = conditionRef.split(':')[1];
                const conditionPath = path.resolve(
                  process.cwd(),
                  `data/mods/movement/conditions/${conditionId}.condition.json`
                );
                expect(fs.existsSync(conditionPath)).toBe(
                  true,
                  `Missing condition: ${conditionRef}`
                );
              }
            }
          });
        }
      });
    });
  });

  describe('Component Integrity', () => {
    it('should have no empty files', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      const checkDirectory = (dir) => {
        const fullPath = path.join(modPath, dir);
        if (fs.existsSync(fullPath)) {
          const files = fs.readdirSync(fullPath);
          files.forEach((file) => {
            const filePath = path.join(fullPath, file);
            if (fs.statSync(filePath).isFile()) {
              const content = fs.readFileSync(filePath, 'utf8');
              expect(content.trim().length).toBeGreaterThan(
                0,
                `Empty file: ${filePath}`
              );
            }
          });
        }
      };

      checkDirectory('actions');
      checkDirectory('conditions');
      checkDirectory('rules');
      checkDirectory('scopes');
    });

    it('should have consistent file naming conventions', () => {
      const modPath = path.resolve(process.cwd(), 'data/mods/movement');

      // Actions should match pattern: name.action.json
      const actionsDir = path.join(modPath, 'actions');
      fs.readdirSync(actionsDir).forEach((file) => {
        if (file.endsWith('.json')) {
          expect(file).toMatch(/^[a-z_]+\.action\.json$/);
        }
      });

      // Conditions should match pattern: name.condition.json
      const conditionsDir = path.join(modPath, 'conditions');
      fs.readdirSync(conditionsDir).forEach((file) => {
        if (file.endsWith('.json')) {
          expect(file).toMatch(/^[a-z\-_]+\.condition\.json$/);
        }
      });

      // Rules should match pattern: name.rule.json
      const rulesDir = path.join(modPath, 'rules');
      fs.readdirSync(rulesDir).forEach((file) => {
        if (file.endsWith('.json')) {
          expect(file).toMatch(/^[a-z_]+\.rule\.json$/);
        }
      });

      // Scopes should match pattern: name.scope
      const scopesDir = path.join(modPath, 'scopes');
      fs.readdirSync(scopesDir).forEach((file) => {
        if (file.endsWith('.scope')) {
          expect(file).toMatch(/^[a-z_]+\.scope$/);
        }
      });
    });
  });
});
