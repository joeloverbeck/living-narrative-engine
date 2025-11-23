/**
 * @file Integration test for notes component subjectType enum validation
 * Ensures "habit" and "philosophy" subjectTypes are present in the schema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('Notes Component - SubjectType Validation', () => {
  let notesComponent;
  let threadscarCharacter;

  beforeEach(async () => {
    // Load the notes component schema
    const notesPath = resolve('data/mods/core/components/notes.component.json');
    const notesContent = await fs.readFile(notesPath, 'utf8');
    notesComponent = JSON.parse(notesContent);

    // Load Threadscar Melissa character
    const characterPath = resolve('data/mods/fantasy/entities/definitions/threadscar_melissa.character.json');
    const characterContent = await fs.readFile(characterPath, 'utf8');
    threadscarCharacter = JSON.parse(characterContent);
  });

  afterEach(() => {
    notesComponent = null;
    threadscarCharacter = null;
  });

  it('should include "habit" in the subjectType enum', () => {
    // Assert
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;
    expect(enumValues).toContain('habit');
  });

  it('should include "philosophy" in the subjectType enum', () => {
    // Assert
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;
    expect(enumValues).toContain('philosophy');
  });

  it('should have all expected enum values including new ones', () => {
    // Arrange
    const expectedEnumValues = [
      'character',
      'location',
      'item',
      'creature',
      'event',
      'concept',
      'relationship',
      'organization',
      'quest',
      'skill',
      'emotion',
      'plan',
      'timeline',
      'theory',
      'observation',
      'knowledge_state',
      'psychological_state',
      'habit',        // New
      'philosophy',   // New
      'other',
    ];

    // Act
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;

    // Assert: All expected values should be present
    expectedEnumValues.forEach((expectedValue) => {
      expect(enumValues).toContain(expectedValue);
    });
  });

  it('should verify Threadscar Melissa character uses habit subjectType', () => {
    // Assert: Character should have notes component
    const notes = threadscarCharacter.components['core:notes'];
    expect(notes).toBeDefined();
    expect(notes.notes).toBeInstanceOf(Array);

    // Assert: Should contain at least one habit note
    const habitNote = notes.notes.find(note => note.subjectType === 'habit');
    expect(habitNote).toBeDefined();
    expect(habitNote.subjectType).toBe('habit');
  });

  it('should verify Threadscar Melissa character uses philosophy subjectType', () => {
    // Assert: Character should have notes component
    const notes = threadscarCharacter.components['core:notes'];
    expect(notes).toBeDefined();
    expect(notes.notes).toBeInstanceOf(Array);

    // Assert: Should contain at least one philosophy note
    const philosophyNote = notes.notes.find(note => note.subjectType === 'philosophy');
    expect(philosophyNote).toBeDefined();
    expect(philosophyNote.subjectType).toBe('philosophy');
  });

  it('should ensure enum ordering is maintained with new values before "other"', () => {
    // Arrange
    const enumValues = notesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;

    // Act: Find indices
    const habitIndex = enumValues.indexOf('habit');
    const philosophyIndex = enumValues.indexOf('philosophy');
    const otherIndex = enumValues.indexOf('other');

    // Assert: New values should come before "other"
    expect(habitIndex).toBeGreaterThan(-1);
    expect(philosophyIndex).toBeGreaterThan(-1);
    expect(otherIndex).toBeGreaterThan(-1);
    expect(habitIndex).toBeLessThan(otherIndex);
    expect(philosophyIndex).toBeLessThan(otherIndex);
  });
});
