/**
 * @file Integration tests for Damage Simulator event definitions
 * @description Verifies that all events dispatched by the damage simulator
 * have proper event definitions in the mod system with correct schemas.
 * @see DamageExecutionService.js - Dispatches execution events
 * @see DamageSimulatorUI.js - Dispatches UI events
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import DamageExecutionService from '../../../../src/domUI/damage-simulator/DamageExecutionService.js';

const EVENTS_DIR = path.join(
  process.cwd(),
  'data/mods/core/events'
);

/**
 * Helper to load and parse an event definition JSON file
 * @param {string} eventId - The event ID (e.g., 'core:damage_simulator_execution_started')
 * @returns {object|null} The parsed event definition or null if not found
 */
function loadEventDefinition(eventId) {
  // Convert event ID to filename (e.g., 'core:damage_simulator_execution_started' -> 'damage_simulator_execution_started.event.json')
  const [, eventName] = eventId.split(':');
  const filename = `${eventName}.event.json`;
  const filepath = path.join(EVENTS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

describe('Damage Simulator Event Definitions', () => {
  describe('Execution Event Definitions', () => {
    it('should have event definition for damage_simulator_execution_started', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_STARTED;
      const definition = loadEventDefinition(eventId);

      expect(definition).not.toBeNull();
      expect(definition.id).toBe(eventId);
      expect(definition.payloadSchema).toBeDefined();
      expect(definition.payloadSchema.type).toBe('object');
      expect(definition.payloadSchema.properties.entityId).toBeDefined();
      expect(definition.payloadSchema.properties.damageEntry).toBeDefined();
    });

    it('should have event definition for damage_simulator_execution_complete', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE;
      const definition = loadEventDefinition(eventId);

      expect(definition).not.toBeNull();
      expect(definition.id).toBe(eventId);
      expect(definition.payloadSchema).toBeDefined();
      expect(definition.payloadSchema.type).toBe('object');
      expect(definition.payloadSchema.properties.entityId).toBeDefined();
      expect(definition.payloadSchema.properties.results).toBeDefined();
    });

    it('should have event definition for damage_simulator_execution_error', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_ERROR;
      const definition = loadEventDefinition(eventId);

      expect(definition).not.toBeNull();
      expect(definition.id).toBe(eventId);
      expect(definition.payloadSchema).toBeDefined();
      expect(definition.payloadSchema.type).toBe('object');
      expect(definition.payloadSchema.properties.entityId).toBeDefined();
      expect(definition.payloadSchema.properties.error).toBeDefined();
    });

    it('should require entityId and damageEntry for execution_started', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_STARTED;
      const definition = loadEventDefinition(eventId);

      expect(definition.payloadSchema.required).toContain('entityId');
      expect(definition.payloadSchema.required).toContain('damageEntry');
    });

    it('should require entityId and results for execution_complete', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE;
      const definition = loadEventDefinition(eventId);

      expect(definition.payloadSchema.required).toContain('entityId');
      expect(definition.payloadSchema.required).toContain('results');
    });

    it('should require entityId and error for execution_error', () => {
      const eventId = DamageExecutionService.EXECUTION_EVENTS.EXECUTION_ERROR;
      const definition = loadEventDefinition(eventId);

      expect(definition.payloadSchema.required).toContain('entityId');
      expect(definition.payloadSchema.required).toContain('error');
    });
  });

  describe('UI Event Definitions', () => {
    const REFRESH_REQUESTED_EVENT = 'core:damage_simulator_refresh_requested';

    it('should have event definition for damage_simulator_refresh_requested', () => {
      const definition = loadEventDefinition(REFRESH_REQUESTED_EVENT);

      expect(definition).not.toBeNull();
      expect(definition.id).toBe(REFRESH_REQUESTED_EVENT);
      expect(definition.payloadSchema).toBeDefined();
    });

    it('should accept instanceId in refresh_requested payload schema', () => {
      const definition = loadEventDefinition(REFRESH_REQUESTED_EVENT);

      expect(definition.payloadSchema.properties.instanceId).toBeDefined();
      expect(definition.payloadSchema.properties.instanceId.type).toBe('string');
    });

    it('should accept reason in refresh_requested payload schema', () => {
      const definition = loadEventDefinition(REFRESH_REQUESTED_EVENT);

      expect(definition.payloadSchema.properties.reason).toBeDefined();
      expect(definition.payloadSchema.properties.reason.type).toBe('string');
    });

    it('should disallow additional properties in refresh_requested', () => {
      const definition = loadEventDefinition(REFRESH_REQUESTED_EVENT);

      expect(definition.payloadSchema.additionalProperties).toBe(false);
    });
  });

  describe('Event ID Namespace Consistency', () => {
    it('should use core namespace for all execution events', () => {
      const events = DamageExecutionService.EXECUTION_EVENTS;

      expect(events.EXECUTION_STARTED).toMatch(/^core:/);
      expect(events.EXECUTION_COMPLETE).toMatch(/^core:/);
      expect(events.EXECUTION_ERROR).toMatch(/^core:/);
    });

    it('should use snake_case naming convention for event IDs', () => {
      const events = DamageExecutionService.EXECUTION_EVENTS;

      // Should match pattern like 'core:damage_simulator_*'
      expect(events.EXECUTION_STARTED).toMatch(/^core:damage_simulator_[a-z_]+$/);
      expect(events.EXECUTION_COMPLETE).toMatch(/^core:damage_simulator_[a-z_]+$/);
      expect(events.EXECUTION_ERROR).toMatch(/^core:damage_simulator_[a-z_]+$/);
    });
  });
});
