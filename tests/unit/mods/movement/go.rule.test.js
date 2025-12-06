import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Movement Go Rule', () => {
  let rule;

  beforeEach(() => {
    const rulePath = path.resolve(
      process.cwd(),
      'data/mods/movement/rules/go.rule.json'
    );
    const ruleContent = fs.readFileSync(rulePath, 'utf8');
    rule = JSON.parse(ruleContent);
  });

  it('should have correct rule_id', () => {
    expect(rule.rule_id).toBe('handle_go_action');
  });

  it('should have comment field', () => {
    expect(rule.comment).toBeDefined();
    expect(typeof rule.comment).toBe('string');
  });

  it('should have event_type field', () => {
    expect(rule.event_type).toBeDefined();
    expect(rule.event_type).toBe('core:attempt_action');
  });

  it('should reference movement:event-is-action-go condition', () => {
    expect(rule.condition).toBeDefined();
    expect(rule.condition.condition_ref).toBe('movement:event-is-action-go');
  });

  it('should have actions array', () => {
    expect(Array.isArray(rule.actions)).toBe(true);
    expect(rule.actions.length).toBeGreaterThan(0);
  });

  it('should have the correct JSON schema reference', () => {
    expect(rule.$schema).toBe(
      'schema://living-narrative-engine/rule.schema.json'
    );
  });

  it('should have a valid condition structure', () => {
    // The rule uses a single condition object, not an array
    expect(rule.condition).toBeDefined();
    expect(typeof rule.condition).toBe('object');

    // Check if it's a valid condition reference
    expect(rule.condition.condition_ref).toBeDefined();
    expect(typeof rule.condition.condition_ref).toBe('string');
  });

  describe('Migration Metadata', () => {
    it('should have migration metadata if migrated', () => {
      // Only check if metadata exists (not all rules may have been migrated)
      if (rule.metadata) {
        expect(rule.metadata.migratedFrom).toBeDefined();
        expect(rule.metadata.migrationTicket).toBeDefined();
        expect(rule.metadata.version).toBeDefined();

        if (rule.metadata.migrationDate) {
          const date = new Date(rule.metadata.migrationDate);
          expect(date.toString()).not.toBe('Invalid Date');
        }
      }
    });
  });
});
