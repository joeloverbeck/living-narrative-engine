import { describe, it, expect, beforeAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Intimacy Actions Validation - INTMIG-006', () => {
  let ajv;
  let validateAction;
  let intimacyActions;

  beforeAll(async () => {
    // Setup AJV with all schemas
    ajv = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
    });
    addFormats(ajv);

    // Load all schemas to resolve references
    const schemasDir = path.join(process.cwd(), 'data/schemas');
    const schemaFiles = await fs.readdir(schemasDir);

    for (const schemaFile of schemaFiles) {
      if (
        schemaFile.endsWith('.schema.json') &&
        schemaFile !== 'action.schema.json'
      ) {
        const schemaPath = path.join(schemasDir, schemaFile);
        try {
          const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
          if (schema.$id) {
            ajv.addSchema(schema, schema.$id);
          }
        } catch (err) {
          // Ignore schemas that can't be loaded
        }
      }
    }

    // Load and compile action schema
    const actionSchemaPath = path.join(schemasDir, 'action.schema.json');
    const actionSchema = JSON.parse(
      await fs.readFile(actionSchemaPath, 'utf8')
    );
    validateAction = ajv.compile(actionSchema);

    // Load all intimacy actions
    const actionsDir = path.join(process.cwd(), 'data/mods/intimacy/actions');
    const files = await fs.readdir(actionsDir);
    intimacyActions = [];

    for (const file of files) {
      if (file.endsWith('.action.json')) {
        const filePath = path.join(actionsDir, file);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
        intimacyActions.push({
          file,
          name: file.replace('.action.json', ''),
          content,
        });
      }
    }
  });

  describe('Migration Completeness', () => {
    it('should have all actions using targets format', () => {
      const actionsWithTargets = intimacyActions.filter(
        (a) => 'targets' in a.content
      );
      // All intimacy actions should use the new targets format
      expect(actionsWithTargets.length).toBe(intimacyActions.length);
    });

    it('should have no actions with root-level scope property', () => {
      const actionsWithScope = intimacyActions.filter(
        (a) => 'scope' in a.content
      );
      expect(actionsWithScope.length).toBe(0);
    });
  });

  describe('Schema Validation', () => {
    it('should validate all actions against action.schema.json', () => {
      const invalidActions = [];

      for (const action of intimacyActions) {
        const valid = validateAction(action.content);
        if (!valid) {
          invalidActions.push({
            name: action.name,
            errors: validateAction.errors,
          });
        }
      }

      expect(invalidActions).toEqual([]);
    });
  });

  describe('ID Consistency', () => {
    it('should have all action IDs matching their filenames', () => {
      const mismatches = [];

      for (const action of intimacyActions) {
        const expectedId = `intimacy:${action.name}`;
        if (action.content.id !== expectedId) {
          mismatches.push({
            file: action.file,
            expected: expectedId,
            actual: action.content.id,
          });
        }
      }

      expect(mismatches).toEqual([]);
    });

    it('should have no duplicate IDs', () => {
      const ids = intimacyActions.map((a) => a.content.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('Template Validation', () => {
    it('should have correct placeholders in all templates', () => {
      const errors = [];

      for (const action of intimacyActions) {
        const template = action.content.template;
        const targets = action.content.targets;

        if (!template) continue;

        if (typeof targets === 'object' && !Array.isArray(targets)) {
          // Multi-target action
          if (targets.primary && !template.includes('{primary}')) {
            errors.push(`${action.name}: Missing {primary} in template`);
          }
          if (targets.secondary && !template.includes('{secondary}')) {
            errors.push(`${action.name}: Missing {secondary} in template`);
          }
          if (targets.tertiary && !template.includes('{tertiary}')) {
            errors.push(`${action.name}: Missing {tertiary} in template`);
          }
        } else {
          // Single-target action
          if (!template.includes('{target}')) {
            errors.push(
              `${action.name}: Missing {target} in template "${template}"`
            );
          }
        }
      }

      expect(errors).toEqual([]);
    });
  });

  describe('Scope References', () => {
    it('should have all referenced scopes existing', async () => {
      const missingScopes = [];
      const scopes = new Set();

      // Collect all scope references
      for (const action of intimacyActions) {
        const targets = action.content.targets;

        if (typeof targets === 'string') {
          scopes.add(targets);
        } else if (typeof targets === 'object' && !Array.isArray(targets)) {
          for (const target of Object.values(targets)) {
            if (target.scope) {
              scopes.add(target.scope);
            }
          }
        }
      }

      // Check each scope exists
      for (const scope of scopes) {
        const [mod, name] = scope.split(':');
        if (mod && name) {
          const scopePath = path.join(
            process.cwd(),
            `data/mods/${mod}/scopes/${name}.scope`
          );
          try {
            await fs.access(scopePath);
          } catch {
            missingScopes.push(scope);
          }
        }
      }

      expect(missingScopes).toEqual([]);
    });
  });

  describe('Special Cases', () => {
    it('should have adjust_clothing using multi-target format', () => {
      const adjustClothing = intimacyActions.find(
        (a) => a.name === 'adjust_clothing'
      );
      expect(adjustClothing).toBeDefined();

      const targets = adjustClothing.content.targets;
      expect(typeof targets).toBe('object');
      expect(targets.primary).toBeDefined();
      expect(targets.secondary).toBeDefined();

      const template = adjustClothing.content.template;
      expect(template).toContain('{primary}');
      expect(template).toContain('{secondary}');
    });

    it('should have cross-mod references working', () => {
      const crossModActions = intimacyActions.filter((a) => {
        const targets = a.content.targets;
        if (typeof targets === 'string') {
          return (
            targets.startsWith('positioning:') ||
            targets.startsWith('clothing:')
          );
        }
        if (typeof targets === 'object' && !Array.isArray(targets)) {
          return Object.values(targets).some(
            (t) =>
              t.scope &&
              (t.scope.startsWith('positioning:') ||
                t.scope.startsWith('clothing:'))
          );
        }
        return false;
      });

      // We know there are at least 3 cross-mod references
      expect(crossModActions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Component Validation', () => {
    it('should have valid component references', () => {
      const knownComponents = new Set([
        'positioning:closeness',
        'positioning:facing_away',
        'intimacy:kissing',
        'anatomy:mouth',
        'clothing:torso_upper',
      ]);

      const unknownComponents = [];

      for (const action of intimacyActions) {
        // Check required components
        if (action.content.required_components) {
          for (const [entity, components] of Object.entries(
            action.content.required_components
          )) {
            for (const comp of components) {
              if (!comp.includes(':')) {
                unknownComponents.push(
                  `${action.name}: Invalid component format "${comp}"`
                );
              }
            }
          }
        }

        // Check forbidden components
        if (action.content.forbidden_components) {
          for (const [entity, components] of Object.entries(
            action.content.forbidden_components
          )) {
            for (const comp of components) {
              if (!comp.includes(':')) {
                unknownComponents.push(
                  `${action.name}: Invalid component format "${comp}"`
                );
              }
            }
          }
        }
      }

      expect(unknownComponents).toEqual([]);
    });
  });
});
