import { describe, it, expect, jest } from '@jest/globals';
import { StructureResolver } from '../../../src/utils/structureResolver.js';
import { safeResolvePath } from '../../../src/utils/objectUtils.js';

class RecordingLogger {
  constructor() {
    this.debug = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.error = jest.fn();
  }
}

describe('StructureResolver integration', () => {
  it('resolves complex placeholder structures across multiple data sources', () => {
    const logger = new RecordingLogger();
    const resolver = new StructureResolver(
      (source, path) =>
        safeResolvePath(source, path, logger, 'StructureResolverTest').value,
      logger
    );

    const primaryContext = {
      actor: {
        name: 'Ada',
        appearance: { hair: undefined, eyes: 'green' },
        stats: { level: 5, health: 42 },
      },
      inventory: {
        primary: 'Rusty Sword',
        extra: { id: 'amulet-1', meta: { rarity: 'rare', level: 10 } },
      },
      nullField: null,
    };

    const secondaryContext = {
      environment: {
        location: 'Ancient Ruins',
      },
    };

    const fallback = {
      fallback: { note: 'Remember to restock potions.' },
    };

    const template = {
      message: 'Greetings {actor.name}! You wield {inventory.primary}.',
      rawTemplate: '{actor.name}',
      stats: '{actor.stats}',
      optionalDescription: '{fallback.note?}',
      missingOptional: '{actor.nickname?}',
      missingRequired: '{inventory.missingSlot}',
      definedUndefined: 'Hair: {actor.appearance.hair}!',
      nestedArray: [
        '{actor.name}',
        { label: 'Rarity', value: '{inventory.extra.meta.rarity}' },
        'Optional blank: {actor.nickname?}',
      ],
      nestedObject: {
        id: '{inventory.extra.id}',
        meta: '{inventory.extra.meta}',
      },
      location: 'Location: {environment.location}',
      nullValue: 'Null test {nullField}',
    };

    const resolved = resolver.resolveStructure(
      template,
      [primaryContext, secondaryContext],
      fallback,
      ['rawTemplate']
    );

    expect(resolved).not.toBe(template);
    expect(resolved.message).toBe('Greetings Ada! You wield Rusty Sword.');
    expect(resolved.rawTemplate).toBe('{actor.name}');
    expect(resolved.stats).toEqual(primaryContext.actor.stats);
    expect(resolved.optionalDescription).toBe('Remember to restock potions.');
    expect(resolved.missingOptional).toBeUndefined();
    expect(resolved.missingRequired).toBeUndefined();
    expect(resolved.definedUndefined).toBe('Hair: !');
    expect(resolved.nestedArray).toEqual([
      'Ada',
      { label: 'Rarity', value: 'rare' },
      'Optional blank: ',
    ]);
    expect(resolved.nestedObject).toEqual({
      id: 'amulet-1',
      meta: primaryContext.inventory.extra.meta,
    });
    expect(resolved.location).toBe('Location: Ancient Ruins');
    expect(resolved.nullValue).toBe('Null test ');

    expect(logger.warn).not.toHaveBeenCalled();

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'PlaceholderResolver: Placeholder "{inventory.missingSlot}" not found in provided data sources. Replacing with empty string.'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) => message.includes('{actor.nickname?}'))
    ).toBe(false);
    expect(
      debugMessages.some((message) =>
        message.includes('Resolved full string placeholder {actor.stats}')
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes('Replaced embedded placeholder {actor.name}')
      )
    ).toBe(true);
  });
});
