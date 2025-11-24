/**
 * @file Integration test for notes component subjectType enum validation
 * Validates simplified 6-type taxonomy (LLMROLPROARCANA-002)
 * @version 2.0 - Updated for simplified taxonomy
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { LEGACY_TYPE_MIGRATION } from '../../../src/constants/subjectTypes.js';

describe('Notes Component - SubjectType Validation (Simplified Taxonomy)', () => {
  let notesComponent;

  beforeEach(async () => {
    // Load the notes component schema
    const notesPath = resolve('data/mods/core/components/notes.component.json');
    const notesContent = await fs.readFile(notesPath, 'utf8');
    notesComponent = JSON.parse(notesContent);
  });

  afterEach(() => {
    notesComponent = null;
  });

  it('should include all 6 simplified subject types', () => {
    // Arrange
    const expectedEnumValues = [
      'entity',
      'event',
      'plan',
      'knowledge',
      'state',
      'other',
    ];

    // Act
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;

    // Assert: All expected values should be present
    expect(enumValues).toHaveLength(6);
    expectedEnumValues.forEach((expectedValue) => {
      expect(enumValues).toContain(expectedValue);
    });
  });

  it('should not include legacy 19-type taxonomy values', () => {
    // Arrange
    const legacyValues = [
      'character', 'location', 'item', 'creature', 'organization',
      'concept', 'relationship', 'quest', 'skill', 'emotion',
      'timeline', 'theory', 'observation', 'knowledge_state',
      'psychological_state', 'habit', 'philosophy',
    ];

    // Act
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;

    // Assert: No legacy values should be present
    legacyValues.forEach((legacyValue) => {
      expect(enumValues).not.toContain(legacyValue);
    });
  });

  it('should have "other" as the last enum value', () => {
    // Act
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;
    const lastValue = enumValues[enumValues.length - 1];

    // Assert
    expect(lastValue).toBe('other');
  });

  it('should have migration mapping for all legacy types', () => {
    // Arrange
    const legacyTypes = [
      'character', 'location', 'item', 'creature', 'organization',
      'event', 'timeline', 'plan', 'quest',
      'theory', 'observation', 'knowledge_state', 'concept', 'philosophy',
      'emotion', 'psychological_state', 'relationship', 'skill', 'habit',
      'other',
    ];

    // Assert: All legacy types should have migration mapping
    legacyTypes.forEach((legacyType) => {
      expect(LEGACY_TYPE_MIGRATION).toHaveProperty(legacyType);
      expect(typeof LEGACY_TYPE_MIGRATION[legacyType]).toBe('string');
    });
  });

  it('should map habit to state in legacy migration', () => {
    expect(LEGACY_TYPE_MIGRATION.habit).toBe('state');
  });

  it('should map philosophy to knowledge in legacy migration', () => {
    expect(LEGACY_TYPE_MIGRATION.philosophy).toBe('knowledge');
  });
});
