/**
 * @file Integration test verifying all status effect events have definitions.
 * Reproduces the issue where ValidatedEventDispatcher warned about missing event definitions
 * for anatomy:fractured, anatomy:burning_started, etc.
 * @see https://github.com/joeloverbeck/living-narrative-engine/issues/XXX
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ANATOMY_EVENTS_DIR = path.resolve('data/mods/anatomy/events');
const STATUS_EFFECTS_REGISTRY = path.resolve(
  'data/mods/anatomy/status-effects/status-effects.registry.json'
);
const MOD_MANIFEST = path.resolve('data/mods/anatomy/mod-manifest.json');

describe('Status Effect Event Definitions', () => {
  let statusEffectsRegistry;
  let modManifest;

  beforeAll(() => {
    statusEffectsRegistry = JSON.parse(
      fs.readFileSync(STATUS_EFFECTS_REGISTRY, 'utf-8')
    );
    modManifest = JSON.parse(fs.readFileSync(MOD_MANIFEST, 'utf-8'));
  });

  describe('Event definition files exist for all referenced events', () => {
    it.each([
      ['anatomy:fractured', 'fractured.event.json'],
      ['anatomy:burning_started', 'burning_started.event.json'],
      ['anatomy:burning_stopped', 'burning_stopped.event.json'],
      ['anatomy:poisoned_started', 'poisoned_started.event.json'],
      ['anatomy:poisoned_stopped', 'poisoned_stopped.event.json'],
      ['anatomy:bleeding_started', 'bleeding_started.event.json'],
      ['anatomy:bleeding_stopped', 'bleeding_stopped.event.json'],
      ['anatomy:dismembered', 'dismembered.event.json'],
    ])('should have event definition file for %s', (eventId, filename) => {
      const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
      expect(fs.existsSync(filepath)).toBe(true);

      const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      expect(definition.id).toBe(eventId);
      expect(definition.payloadSchema).toBeDefined();
      expect(definition.payloadSchema.type).toBe('object');
      expect(definition.payloadSchema.properties).toBeDefined();
      expect(definition.payloadSchema.required).toBeDefined();
    });
  });

  describe('Mod manifest includes all status effect events', () => {
    it('should include all status effect event files in manifest', () => {
      const manifestEvents = modManifest.content.events;

      const requiredEvents = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
        'bleeding_started.event.json',
        'bleeding_stopped.event.json',
        'dismembered.event.json',
      ];

      for (const eventFile of requiredEvents) {
        expect(manifestEvents).toContain(eventFile);
      }
    });
  });

  describe('Status effects registry references valid events', () => {
    it('should have all startedEventId references resolvable', () => {
      for (const effect of statusEffectsRegistry.effects) {
        if (effect.startedEventId) {
          const [, eventName] = effect.startedEventId.split(':');
          const filename = `${eventName}.event.json`;
          const filepath = path.join(ANATOMY_EVENTS_DIR, filename);

          expect(fs.existsSync(filepath)).toBe(true);
        }
      }
    });

    it('should have all stoppedEventId references resolvable', () => {
      for (const effect of statusEffectsRegistry.effects) {
        if (effect.stoppedEventId) {
          const [, eventName] = effect.stoppedEventId.split(':');
          const filename = `${eventName}.event.json`;
          const filepath = path.join(ANATOMY_EVENTS_DIR, filename);

          expect(fs.existsSync(filepath)).toBe(true);
        }
      }
    });
  });

  describe('Event payload schemas have required fields', () => {
    it('should require entityId in most status effect events (except poisoned_stopped which uses scope)', () => {
      // poisoned_stopped uses scope-based targeting where entityId is only present when scope='entity'
      const statusEffectEventsRequiringEntityId = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'bleeding_started.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEventsRequiringEntityId) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.payloadSchema.properties.entityId).toBeDefined();
        expect(definition.payloadSchema.required).toContain('entityId');
      }
    });

    it('should have entityId as optional for poisoned_stopped (scope-based targeting)', () => {
      // poisoned_stopped sends entityId only when scope='entity', partId when scope='part'
      const filepath = path.join(ANATOMY_EVENTS_DIR, 'poisoned_stopped.event.json');
      const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

      // entityId should be defined but NOT required
      expect(definition.payloadSchema.properties.entityId).toBeDefined();
      expect(definition.payloadSchema.required).not.toContain('entityId');
    });

    it('should require partId in most status effect events (except poison which uses scope)', () => {
      // Poison events use scope-based targeting where partId is optional
      // (partId when scope='part', entityId when scope='entity')
      const statusEffectEventsRequiringPartId = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'bleeding_started.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEventsRequiringPartId) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.payloadSchema.properties.partId).toBeDefined();
        expect(definition.payloadSchema.required).toContain('partId');
      }
    });

    it('should have partId as optional for poison events (scope-based targeting)', () => {
      // Poison events support both part-scoped and entity-scoped targeting
      // partId is only present when scope='part'
      const poisonEvents = [
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
      ];

      for (const filename of poisonEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        // partId should be defined as a property but NOT required
        expect(definition.payloadSchema.properties.partId).toBeDefined();
        expect(definition.payloadSchema.required).not.toContain('partId');

        // scope should be required instead
        expect(definition.payloadSchema.properties.scope).toBeDefined();
        expect(definition.payloadSchema.required).toContain('scope');
      }
    });

    it('should require timestamp in all status effect events', () => {
      const statusEffectEvents = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
        'bleeding_started.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.payloadSchema.properties.timestamp).toBeDefined();
        expect(definition.payloadSchema.required).toContain('timestamp');
      }
    });

    it('should require reason in stopped events', () => {
      const stoppedEvents = [
        'burning_stopped.event.json',
        'poisoned_stopped.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of stoppedEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.payloadSchema.properties.reason).toBeDefined();
        expect(definition.payloadSchema.properties.reason.enum).toBeDefined();
        expect(definition.payloadSchema.required).toContain('reason');
      }
    });
  });

  describe('Event schema structure follows project conventions', () => {
    it('should have additionalProperties set to false', () => {
      const statusEffectEvents = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.payloadSchema.additionalProperties).toBe(false);
      }
    });

    it('should reference the event schema', () => {
      const statusEffectEvents = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.$schema).toContain('event.schema.json');
      }
    });

    it('should use anatomy namespace for event IDs', () => {
      const statusEffectEvents = [
        'fractured.event.json',
        'burning_started.event.json',
        'burning_stopped.event.json',
        'poisoned_started.event.json',
        'poisoned_stopped.event.json',
        'bleeding_stopped.event.json',
      ];

      for (const filename of statusEffectEvents) {
        const filepath = path.join(ANATOMY_EVENTS_DIR, filename);
        const definition = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        expect(definition.id).toMatch(/^anatomy:/);
      }
    });
  });
});
