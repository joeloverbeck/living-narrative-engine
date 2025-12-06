import { beforeEach, describe, expect, it } from '@jest/globals';
import { ExecutionPlaceholderResolver } from '../../../src/utils/executionPlaceholderResolver.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class MemoryLogger {
  constructor(label = 'memory') {
    this.label = label;
    this.entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #record(level, message, args) {
    this.entries[level].push({ message, args });
  }

  debug(message, ...args) {
    this.#record('debug', message, args);
  }

  info(message, ...args) {
    this.#record('info', message, args);
  }

  warn(message, ...args) {
    this.#record('warn', message, args);
  }

  error(message, ...args) {
    this.#record('error', message, args);
  }
}

const createEntity = (id, name) => ({
  id,
  definitionId: `${id}-definition`,
  components: {
    [NAME_COMPONENT_ID]: { text: name },
  },
  getComponentData(type) {
    return this.components[type];
  },
  get componentTypeIds() {
    return Object.keys(this.components);
  },
});

const createExecutionContext = () => ({
  actor: createEntity('actor-1', 'Alex'),
  target: createEntity('target-5', 'Riley'),
  metadata: { scene: 'docks' },
  evaluationContext: {
    context: {
      weather: 'rainy',
      nested: { mood: 'melancholic' },
    },
  },
  context: {
    immediate: 'immediate-context-value',
  },
});

describe('ExecutionPlaceholderResolver - real module integration', () => {
  /** @type {MemoryLogger} */
  let logger;
  /** @type {ExecutionPlaceholderResolver} */
  let resolver;
  /** @type {ReturnType<typeof createExecutionContext>} */
  let executionContext;

  beforeEach(() => {
    logger = new MemoryLogger();
    resolver = new ExecutionPlaceholderResolver(logger);
    executionContext = createExecutionContext();
  });

  it('resolves placeholders across nested structures using real collaborators', () => {
    const { sources, fallback } = resolver.buildSources(executionContext);

    expect(sources).toHaveLength(3);
    expect(sources[0]).toEqual({
      context: { immediate: 'immediate-context-value' },
    });
    expect(sources[1].actor).toBe(executionContext.actor);
    expect(fallback).toEqual({
      actor: { name: 'Alex' },
      target: { name: 'Riley' },
    });

    const template = {
      summary:
        'Actor {actor.name} meets {target.name} under {context.weather} while visiting {metadata.scene}.',
      nested: {
        mood: '{context.nested.mood}',
        skip: 'It is {context.weather} today.',
        fallbackName: '{target.name}',
      },
      list: [
        '{actor.id}',
        'Optional {context.unknown?}',
        { deep: 'Scene: {metadata.scene}' },
      ],
    };

    const resolved = resolver.resolveFromContext(template, executionContext);

    expect(resolved.summary).toBe(
      'Actor Alex meets Riley under rainy while visiting docks.'
    );
    expect(resolved.nested.mood).toBe('melancholic');
    expect(resolved.nested.skip).toBe('It is rainy today.');
    expect(resolved.nested.fallbackName).toBe('Riley');
    expect(resolved.list[0]).toBe('actor-1');
    expect(resolved.list[1]).toBe('Optional ');
    expect(resolved.list[2].deep).toBe('Scene: docks');

    const debugMessages = logger.entries.debug.map(({ message }) => message);
    expect(
      debugMessages.some(
        (msg) =>
          typeof msg === 'string' &&
          msg.includes(
            'Resolved full string placeholder {target.name} to: Riley'
          )
      )
    ).toBe(true);
    expect(
      debugMessages.some(
        (msg) =>
          typeof msg === 'string' &&
          msg.includes(
            'Resolved full string placeholder {context.nested.mood} to: melancholic'
          )
      )
    ).toBe(true);

    const templateWithSkip = {
      summary: 'Actor {actor.name}',
      nested: {
        mood: '{context.nested.mood}',
      },
    };
    const skipped = resolver.resolveFromContext(
      templateWithSkip,
      executionContext,
      {
        skipKeys: new Set(['nested']),
      }
    );

    expect(skipped.summary).toBe('Actor Alex');
    expect(skipped.nested).toEqual(templateWithSkip.nested);
  });

  it('resolves fallback paths and suppresses context-specific warnings', () => {
    const fallbackValue = resolver.resolvePathFromContext(
      'target.name',
      executionContext,
      'trace/target-name'
    );

    expect(fallbackValue).toBe('Riley');

    const missingContextResult = resolver.resolvePathFromContext(
      'context.weather',
      { ...executionContext, evaluationContext: undefined },
      'trace/missing-context'
    );

    expect(missingContextResult).toBeUndefined();

    const invalidRootResult = resolver.resolvePathFromContext(
      'context.detail',
      null,
      'trace/invalid-root'
    );

    expect(invalidRootResult).toBeUndefined();
    expect(logger.entries.warn).toHaveLength(0);
  });

  it('records warnings for unsupported placeholder usage', () => {
    const blankPathResult = resolver.resolvePathFromContext(
      '',
      executionContext,
      'trace/blank'
    );
    expect(blankPathResult).toBeUndefined();

    const invalidRootResult = resolver.resolvePathFromContext(
      'actor',
      null,
      'trace/no-context'
    );
    expect(invalidRootResult).toBeUndefined();

    const warnings = logger.entries.warn.map(({ message }) => message);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain(
      'Failed to extract path from placeholder at trace/blank'
    );
    expect(warnings[1]).toContain(
      'Cannot resolve placeholder path "actor" at trace/no-context'
    );
  });
});
