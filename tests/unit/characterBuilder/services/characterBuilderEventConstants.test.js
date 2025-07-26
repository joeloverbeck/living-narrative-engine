/**
 * @file Unit test for CHARACTER_BUILDER_EVENTS constants
 * Ensures all event names follow the proper namespaced pattern
 */

import { describe, it, expect } from '@jest/globals';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('CHARACTER_BUILDER_EVENTS - Event Constants', () => {
  it('should use namespaced event names for all events', () => {
    // Verify each event uses the 'thematic:' namespace
    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED).toBe('thematic:character_concept_created');
    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED).toBe('thematic:character_concept_updated');
    expect(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED).toBe('thematic:thematic_directions_generated');
    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_SAVED).toBe('thematic:character_concept_saved');
    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED).toBe('thematic:character_concept_deleted');
    expect(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED).toBe('thematic:character_builder_error_occurred');
  });

  it('should follow the namespace:event_name pattern for all events', () => {
    const expectedPattern = /^thematic:[a-z_]+$/;
    
    Object.entries(CHARACTER_BUILDER_EVENTS).forEach(([key, value]) => {
      expect(value).toMatch(expectedPattern);
      expect(value.startsWith('thematic:')).toBe(true);
      
      // Ensure no uppercase letters in the event name part
      const eventNamePart = value.split(':')[1];
      expect(eventNamePart).toBe(eventNamePart.toLowerCase());
    });
  });

  it('should have unique event names', () => {
    const eventValues = Object.values(CHARACTER_BUILDER_EVENTS);
    const uniqueValues = new Set(eventValues);
    
    expect(uniqueValues.size).toBe(eventValues.length);
  });

  it('should contain all expected event types', () => {
    const expectedEventKeys = [
      'CONCEPT_CREATED',
      'CONCEPT_UPDATED',
      'DIRECTIONS_GENERATED',
      'CONCEPT_SAVED',
      'CONCEPT_DELETED',
      'ERROR_OCCURRED'
    ];
    
    expectedEventKeys.forEach(key => {
      expect(CHARACTER_BUILDER_EVENTS).toHaveProperty(key);
      expect(typeof CHARACTER_BUILDER_EVENTS[key]).toBe('string');
    });
  });
});