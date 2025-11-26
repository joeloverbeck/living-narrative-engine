/**
 * @file Integration tests for anatomy event publication namespacing
 *
 * Tests that anatomy generation workflow dispatches events using
 * the correct namespaced event IDs matching event definitions.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

describe('Anatomy Event Publication Namespacing - Integration', () => {
  const MODS_PATH = path.join(process.cwd(), 'data', 'mods');
  const SRC_PATH = path.join(process.cwd(), 'src');

  let anatomyEventDefinition;
  let eventPublicationStageSource;

  beforeAll(async () => {
    // Load the anatomy_generated event definition
    const eventPath = path.join(
      MODS_PATH,
      'anatomy',
      'events',
      'anatomy_generated.event.json'
    );
    const eventContent = await fs.readFile(eventPath, 'utf-8');
    anatomyEventDefinition = JSON.parse(eventContent);

    // Load the eventPublicationStage source code
    const stagePath = path.join(
      SRC_PATH,
      'anatomy',
      'workflows',
      'stages',
      'eventPublicationStage.js'
    );
    eventPublicationStageSource = await fs.readFile(stagePath, 'utf-8');
  });

  describe('Event ID Consistency', () => {
    it('should have anatomy_generated event definition with namespaced ID', () => {
      expect(anatomyEventDefinition).toBeDefined();
      expect(anatomyEventDefinition.id).toBe('anatomy:anatomy_generated');
    });

    it('should dispatch event using the same namespaced ID as the event definition', () => {
      // Extract the event ID used in dispatch call
      // Pattern: eventBus.dispatch('EVENT_ID', {
      const dispatchPattern = /eventBus\.dispatch\(['"]([^'"]+)['"]/g;
      const matches = [...eventPublicationStageSource.matchAll(dispatchPattern)];

      expect(matches.length).toBeGreaterThan(0);

      // Get the event ID used in dispatch
      const dispatchedEventId = matches[0][1];

      // The dispatched event ID should match the event definition ID
      expect(dispatchedEventId).toBe(anatomyEventDefinition.id);
    });

    it('should use namespaced format (modId:eventName) for event dispatch', () => {
      // Extract the event ID used in dispatch
      const dispatchPattern = /eventBus\.dispatch\(['"]([^'"]+)['"]/g;
      const matches = [...eventPublicationStageSource.matchAll(dispatchPattern)];

      for (const match of matches) {
        const eventId = match[1];
        // Check for namespaced format: contains colon and has content on both sides
        const isNamespaced = /^[a-z_]+:[a-z_]+$/i.test(eventId);
        expect(isNamespaced).toBe(true);
      }
    });
  });

  describe('ValidatedEventDispatcher Compatibility', () => {
    it('should use event ID that ValidatedEventDispatcher can resolve', () => {
      // The ValidatedEventDispatcher looks up events by their namespaced ID
      // Using 'ANATOMY_GENERATED' instead of 'anatomy:anatomy_generated' causes
      // the warning: "EventDefinition not found for 'ANATOMY_GENERATED'"

      const dispatchPattern = /eventBus\.dispatch\(['"]([^'"]+)['"]/g;
      const matches = [...eventPublicationStageSource.matchAll(dispatchPattern)];

      for (const match of matches) {
        const eventId = match[1];
        // Should NOT be uppercase-only format (legacy pattern)
        expect(eventId).not.toMatch(/^[A-Z_]+$/);
        // Should be namespaced format
        expect(eventId).toMatch(/^[a-z_]+:[a-z_]+$/i);
      }
    });
  });
});
