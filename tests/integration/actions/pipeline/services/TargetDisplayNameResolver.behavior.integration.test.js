import { describe, it, expect } from '@jest/globals';

import { TargetDisplayNameResolver } from '../../../../../src/actions/pipeline/services/implementations/TargetDisplayNameResolver.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';
import NoOpLogger from '../../../../../src/logging/noOpLogger.js';
import { ServiceError } from '../../../../../src/actions/pipeline/services/base/ServiceError.js';

/**
 * @description Creates a resolver and entity manager pair populated with the provided entities.
 * @param {Array<{id: string, components: Record<string, any>}>} [entities] - Entities to seed in the manager.
 * @returns {{resolver: TargetDisplayNameResolver, entityManager: SimpleEntityManager}}
 */
function createResolver(entities = []) {
  const entityManager = new SimpleEntityManager(entities);
  const resolver = new TargetDisplayNameResolver({
    entityManager,
    logger: new NoOpLogger(),
  });

  return { resolver, entityManager };
}

/**
 * @description Builds a component bag for an entity with commonly used fields.
 * @param {object} params
 * @param {string} [params.name]
 * @param {string} [params.description]
 * @param {string} [params.actor]
 * @param {string} [params.item]
 * @param {{name?: string}} [params.location]
 * @param {{current?: number, max?: number}} [params.health]
 * @returns {Record<string, any>}
 */
function buildComponents({
  name,
  description,
  actor,
  item,
  location,
  health,
} = {}) {
  const components = {};
  if (name) {
    components['core:name'] = { text: name };
  }
  if (description) {
    components['core:description'] = { name: description };
  }
  if (actor) {
    components['core:actor'] = { name: actor };
  }
  if (item) {
    components['core:item'] = { name: item };
  }
  if (location) {
    components['core:location'] = { ...location };
  }
  if (health) {
    components['core:health'] = { ...health };
  }
  return components;
}

describe('TargetDisplayNameResolver integration behavior', () => {
  describe('getEntityDisplayName', () => {
    it('returns fallback for invalid identifiers and logs operation safely', () => {
      const { resolver } = createResolver();

      expect(resolver.getEntityDisplayName(null)).toBe('Unknown Entity');
      expect(resolver.getEntityDisplayName(undefined)).toBe('Unknown Entity');
    });

    it('returns entity id when entity is not found in manager', () => {
      const { resolver } = createResolver();

      expect(resolver.getEntityDisplayName('ghost:entity')).toBe(
        'ghost:entity'
      );
    });

    it('follows component precedence when resolving display names', () => {
      const withName = createResolver([
        {
          id: 'hero:aurora',
          components: buildComponents({
            name: 'Captain Aurora',
            description: 'Aurora the Explorer',
            actor: 'Aurora Actor',
            item: 'Aurora Item',
          }),
        },
      ]);
      expect(withName.resolver.getEntityDisplayName('hero:aurora')).toBe(
        'Captain Aurora'
      );

      const withDescription = createResolver([
        {
          id: 'hero:aurora',
          components: buildComponents({
            description: 'Aurora the Explorer',
            actor: 'Aurora Actor',
            item: 'Aurora Item',
          }),
        },
      ]);
      expect(withDescription.resolver.getEntityDisplayName('hero:aurora')).toBe(
        'Aurora the Explorer'
      );

      const withActor = createResolver([
        {
          id: 'hero:aurora',
          components: buildComponents({
            actor: 'Aurora Actor',
            item: 'Aurora Item',
          }),
        },
      ]);
      expect(withActor.resolver.getEntityDisplayName('hero:aurora')).toBe(
        'Aurora Actor'
      );

      const withItem = createResolver([
        {
          id: 'hero:aurora',
          components: buildComponents({ item: 'Aurora Item' }),
        },
      ]);
      expect(withItem.resolver.getEntityDisplayName('hero:aurora')).toBe(
        'Aurora Item'
      );
    });

    it('falls back to entity id when entity manager throws during lookup', () => {
      class ThrowingEntityManager extends SimpleEntityManager {
        getEntityInstance(id) {
          if (id === 'broken') {
            throw new Error('lookup failed');
          }
          return super.getEntityInstance(id);
        }
      }

      const entityManager = new ThrowingEntityManager([
        { id: 'safe', components: buildComponents({ name: 'Safe' }) },
      ]);
      const resolver = new TargetDisplayNameResolver({
        entityManager,
        logger: new NoOpLogger(),
      });

      expect(resolver.getEntityDisplayName('safe')).toBe('Safe');
      expect(resolver.getEntityDisplayName('broken')).toBe('broken');
    });
  });

  describe('getDisplayName and getDisplayNameDetails', () => {
    it('uses default name when entity is missing and triggers default argument path', () => {
      const { resolver } = createResolver();

      expect(resolver.getDisplayName(null)).toBe('Unknown Entity');
      expect(
        resolver.getDisplayName(
          { id: null },
          { defaultName: 'Mystery Visitor' }
        )
      ).toBe('Mystery Visitor');
    });

    it('provides detailed metadata including source detection and default handling', () => {
      const { resolver, entityManager } = createResolver([
        {
          id: 'lore:keeper',
          components: buildComponents({ description: 'Archive Keeper' }),
        },
      ]);

      // Without name component the description should be used
      let details = resolver.getDisplayNameDetails(
        entityManager.getEntityInstance('lore:keeper')
      );
      expect(details).toMatchObject({
        displayName: 'Archive Keeper',
        source: 'description',
        isDefault: false,
      });

      // Swap to actor component preference
      entityManager.setEntities([
        {
          id: 'lore:keeper',
          components: buildComponents({ actor: 'Archivist Supreme' }),
        },
      ]);
      details = resolver.getDisplayNameDetails(
        entityManager.getEntityInstance('lore:keeper')
      );
      expect(details).toMatchObject({
        displayName: 'Archivist Supreme',
        source: 'actor',
      });

      // Item fallback when actor/name unavailable
      entityManager.setEntities([
        {
          id: 'lore:keeper',
          components: buildComponents({ item: 'Relic Display' }),
        },
      ]);
      details = resolver.getDisplayNameDetails(
        entityManager.getEntityInstance('lore:keeper')
      );
      expect(details).toMatchObject({
        displayName: 'Relic Display',
        source: 'item',
      });

      const mismatchedEntity = {
        id: 'lore:keeper',
        getComponentData: (component) =>
          component === 'core:item' ? { name: 'Obsolete Label' } : null,
      };
      details = resolver.getDisplayNameDetails(mismatchedEntity);
      expect(details).toMatchObject({
        displayName: 'Relic Display',
        source: 'id',
        isDefault: false,
      });

      // Restoring a name component should flip the source back to name
      entityManager.setEntities([
        {
          id: 'lore:keeper',
          components: buildComponents({ name: 'Lorekeeper Lyra' }),
        },
      ]);
      details = resolver.getDisplayNameDetails(
        entityManager.getEntityInstance('lore:keeper')
      );
      expect(details).toMatchObject({
        displayName: 'Lorekeeper Lyra',
        source: 'name',
      });

      // Entities without custom data should report id sourced names
      entityManager.setEntities([
        { id: 'lore:keeper', components: buildComponents({}) },
      ]);
      details = resolver.getDisplayNameDetails(
        entityManager.getEntityInstance('lore:keeper')
      );
      expect(details).toMatchObject({
        displayName: 'lore:keeper',
        source: 'id',
        isDefault: true,
      });

      // When the entity is missing the id, the default is used
      expect(
        resolver.getDisplayNameDetails(
          { id: null },
          { defaultName: 'Unknown Visitor' }
        )
      ).toEqual({
        displayName: 'Unknown Visitor',
        source: 'default',
        isDefault: true,
      });

      expect(resolver.getDisplayNameDetails(null)).toEqual({
        displayName: 'Unknown Entity',
        source: 'default',
        isDefault: true,
      });
    });
  });

  describe('bulk display name helpers', () => {
    it('builds maps for entity instances while skipping invalid entries', () => {
      const entities = [
        { id: 'ally:1', components: buildComponents({ name: 'Ally One' }) },
        {
          id: 'ally:2',
          components: buildComponents({ description: 'Backup Ally' }),
        },
        { id: null, components: {} },
      ];
      const { resolver, entityManager } = createResolver(entities);

      const result = resolver.getDisplayNames([
        entityManager.getEntityInstance('ally:1'),
        entityManager.getEntityInstance('ally:2'),
        null,
        { id: null },
      ]);

      expect(Array.from(result.entries())).toEqual([
        ['ally:1', 'Ally One'],
        ['ally:2', 'Backup Ally'],
      ]);
    });

    it('throws ServiceError when bulk helpers receive invalid inputs', () => {
      const { resolver } = createResolver();

      expect(() => resolver.getDisplayNames('not-an-array')).toThrow(
        ServiceError
      );
      expect(() => resolver.getEntityDisplayNames('invalid')).toThrow(
        ServiceError
      );
    });

    it('resolves entity ids with default argument behaviour', () => {
      const { resolver } = createResolver([
        {
          id: 'figure:1',
          components: buildComponents({ actor: 'Key Figure' }),
        },
      ]);

      expect(
        resolver.getEntityDisplayNames(['figure:1', 'unknown:42'])
      ).toEqual({ 'figure:1': 'Key Figure', 'unknown:42': 'unknown:42' });
    });
  });

  describe('formatWithContext', () => {
    it('enriches names with location and health details when context flags are set', () => {
      const { resolver } = createResolver([
        {
          id: 'scout:1',
          components: buildComponents({
            name: 'Scout Mira',
            location: { name: 'Watchtower' },
            health: { current: 72, max: 100 },
          }),
        },
        {
          id: 'scout:healthy',
          components: buildComponents({
            name: 'Scout Hale',
            location: { name: 'North Ridge' },
            health: { current: 100, max: 100 },
          }),
        },
        {
          id: 'scout:stealth',
          components: buildComponents({ name: 'Scout Shade' }),
        },
      ]);

      const displayName = resolver.formatWithContext(
        { id: 'scout:1' },
        { includeLocation: true, includeState: true }
      );

      expect(displayName).toBe('Scout Mira (at Watchtower) (72% health)');

      // When the health is full the state suffix should be omitted
      const healthyDisplay = resolver.formatWithContext(
        { id: 'scout:healthy' },
        { includeLocation: true, includeState: true }
      );
      expect(healthyDisplay).toBe('Scout Hale (at North Ridge)');

      // Skipping optional context flags should yield the base name for tracked entities
      expect(
        resolver.formatWithContext(
          { id: 'scout:1' },
          { includeLocation: false, includeState: false }
        )
      ).toBe('Scout Mira');

      // Missing context data ensures branches that skip augmentation are covered
      expect(
        resolver.formatWithContext(
          { id: 'scout:stealth' },
          { includeLocation: true, includeState: true }
        )
      ).toBe('Scout Shade');
    });

    it('returns base name when additional context is unavailable', () => {
      const { resolver } = createResolver([
        { id: 'scout:2', components: buildComponents({ name: 'Scout Ryn' }) },
      ]);

      // When entity is not tracked the method should just return the base display name
      expect(
        resolver.formatWithContext({ id: 'missing' }, { includeLocation: true })
      ).toBe('missing');

      // Missing entity object triggers the fallback name and default context argument usage
      expect(resolver.formatWithContext(null)).toBe('Unknown Entity');
    });
  });

  describe('validity checks and configuration', () => {
    it('identifies whether an entity has a meaningful display name', () => {
      const { resolver } = createResolver([
        { id: 'npc:1', components: buildComponents({ name: 'Merchant' }) },
        { id: 'npc:2', components: buildComponents({}) },
      ]);

      expect(resolver.hasValidDisplayName({ id: 'npc:1' })).toBe(true);
      expect(resolver.hasValidDisplayName({ id: 'npc:2' })).toBe(false);
      expect(resolver.hasValidDisplayName(null)).toBe(false);
    });

    it('allows updating the fallback name and enforces type validation', () => {
      const { resolver } = createResolver();

      resolver.setFallbackName('Nameless Wanderer');
      expect(resolver.getEntityDisplayName(null)).toBe('Nameless Wanderer');

      expect(() => resolver.setFallbackName(42)).toThrow(ServiceError);
    });
  });
});
