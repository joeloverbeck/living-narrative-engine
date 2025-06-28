import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { ActorStateProvider } from '../../../../src/data/providers/actorStateProvider.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  SPEECH_PATTERNS_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
} from '../../../../src/constants/textDefaults.js';

class MockEntity {
  constructor(id, components = {}) {
    this.id = id;
    this._components = { ...components };
  }

  get componentEntries() {
    return Object.entries(this._components);
  }

  hasComponent(id) {
    return Object.prototype.hasOwnProperty.call(this._components, id);
  }
}

const logger = { debug: jest.fn() };

beforeEach(() => {
  logger.debug.mockClear();
});

describe('ActorStateProvider', () => {
  it('builds actor state with trimmed text and filtered speech patterns', () => {
    const components = {
      [NAME_COMPONENT_ID]: { text: '  John  ' },
      [DESCRIPTION_COMPONENT_ID]: { text: ' Desc ' },
      [LIKES_COMPONENT_ID]: { text: '  apples  ' },
      [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: [' hi ', '', 'hey'] },
    };
    const entity = new MockEntity('actor1', components);
    const provider = new ActorStateProvider();

    const state = provider.build(entity, logger);

    expect(state.id).toBe('actor1');
    expect(state.components).toEqual(components);
    expect(state.components[DESCRIPTION_COMPONENT_ID]).not.toBe(
      components[DESCRIPTION_COMPONENT_ID]
    );
    expect(state[NAME_COMPONENT_ID]).toEqual({ text: 'John' });
    expect(state[DESCRIPTION_COMPONENT_ID]).toEqual({ text: 'Desc' });
    expect(state[LIKES_COMPONENT_ID]).toEqual({ text: 'apples' });
    expect(state[SPEECH_PATTERNS_COMPONENT_ID]).toEqual({
      patterns: [' hi ', 'hey'],
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'ActorStateProvider: Building actor state for actor1'
    );
  });

  it('uses fallbacks and omits optional data when missing', () => {
    const components = {
      [NAME_COMPONENT_ID]: { text: '   ' },
      [SPEECH_PATTERNS_COMPONENT_ID]: { patterns: ['   ', '', null] },
    };
    const entity = new MockEntity('actor2', components);
    const provider = new ActorStateProvider();

    const state = provider.build(entity, logger);

    expect(state[NAME_COMPONENT_ID]).toEqual({
      text: DEFAULT_FALLBACK_CHARACTER_NAME,
    });
    expect(state[DESCRIPTION_COMPONENT_ID]).toEqual({
      text: DEFAULT_FALLBACK_DESCRIPTION_RAW,
    });
    expect(state[LIKES_COMPONENT_ID]).toBeUndefined();
    expect(state[SPEECH_PATTERNS_COMPONENT_ID]).toBeUndefined();
  });
});
