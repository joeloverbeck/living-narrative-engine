import { describe, it, expect } from '@jest/globals';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';
import { resolveWrapper } from '../../../src/utils/wrapperUtils.js';

class InMemoryLogger {
  constructor() {
    this.messages = [];
  }

  #record(level, message) {
    this.messages.push({ level, message });
  }

  debug(message, ...rest) {
    this.#record('debug', [message, ...rest].join(' '));
  }

  info(message, ...rest) {
    this.#record('info', [message, ...rest].join(' '));
  }

  warn(message, ...rest) {
    this.#record('warn', [message, ...rest].join(' '));
  }

  error(message, ...rest) {
    this.#record('error', [message, ...rest].join(' '));
  }

  groupCollapsed() {}

  groupEnd() {}
}

describe('wrapperUtils integration', () => {
  const createResolver = () => new PlaceholderResolver(new InMemoryLogger());

  it('resolves prefix and suffix placeholders against nested context data', () => {
    const resolver = createResolver();
    const context = {
      actor: {
        name: 'Aria',
        title: 'Sentinel of the North',
      },
      location: {
        name: 'Skyhold',
        descriptor: 'floating bastion',
      },
    };

    const wrappers = {
      prefix: '[[{actor.name} — {actor.title}]]',
      suffix: '--{location.name}::{location.descriptor}--',
    };

    const result = resolveWrapper(wrappers, resolver, context);

    expect(result).toEqual({
      prefix: '[[Aria — Sentinel of the North]]',
      suffix: '--Skyhold::floating bastion--',
    });
  });

  it('falls back to empty wrappers and handles optional placeholders gracefully', () => {
    const resolver = createResolver();
    const context = {
      event: {
        name: 'Edge-Case Summit',
      },
      stats: {},
    };

    const partialWrappers = {
      suffix: 'after {event.name} {stats.energy?}',
    };

    const partiallyResolved = resolveWrapper(
      partialWrappers,
      resolver,
      context
    );
    expect(partiallyResolved).toEqual({
      prefix: '',
      suffix: 'after Edge-Case Summit ',
    });

    const defaultResolved = resolveWrapper(null, resolver, context);
    expect(defaultResolved).toEqual({ prefix: '', suffix: '' });
  });
});
