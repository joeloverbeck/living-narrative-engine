import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptAssembler } from '../../../src/prompting/promptAssembler.js';
import { IPromptElementAssembler } from '../../../src/interfaces/IPromptElementAssembler.js';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';

class TestLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  #record(level, message, details) {
    this[`${level}Entries`].push({ message, details });
  }

  debug(message, details) {
    this.#record('debug', message, details);
  }

  info(message, details) {
    this.#record('info', message, details);
  }

  warn(message, details) {
    this.#record('warn', message, details);
  }

  error(message, details) {
    this.#record('error', message, details);
  }

  messagesFor(level) {
    return this[`${level}Entries`].map((entry) => entry.message);
  }
}

class TemplateElementAssembler extends IPromptElementAssembler {
  assemble(
    elementConfig,
    promptData,
    placeholderResolver,
    allPromptElementsMap
  ) {
    const elementsObject = Object.fromEntries(allPromptElementsMap.entries());
    return placeholderResolver.resolve(
      elementConfig.template,
      promptData,
      { element: elementConfig },
      { elements: elementsObject }
    );
  }
}

class ThrowingElementAssembler extends IPromptElementAssembler {
  assemble(elementConfig, promptData) {
    throw new Error(
      `Failed to assemble ${elementConfig.key} for ${promptData.prompt.title}`
    );
  }
}

describe('PromptAssembler integration', () => {
  let logger;
  let placeholderResolver;
  let promptData;
  let elementDefinitions;

  beforeEach(() => {
    logger = new TestLogger();
    placeholderResolver = new PlaceholderResolver(logger);
    promptData = {
      prompt: {
        title: 'Chronicles of Integration',
        body: 'The assembly combines nested sources.',
      },
      context: {
        location: { name: 'Archive Vault' },
        author: { name: 'Archivist Elowen' },
      },
      stats: {
        iteration: 7,
      },
    };

    elementDefinitions = new Map([
      [
        'header',
        {
          key: 'header',
          template: '### {prompt.title} (v{stats.iteration}) ###\n',
          metadata: { style: 'caps' },
        },
      ],
      [
        'body',
        {
          key: 'body',
          template:
            '{prompt.body}\nLocation: {context.location.name}\nStyle: {elements.header.metadata.style}\n',
          metadata: { section: 'narrative' },
        },
      ],
      [
        'optional',
        {
          key: 'optional',
          template: 'Optional hints: {element.metadata.optionalNote?}\n',
          metadata: {},
        },
      ],
      [
        'footer',
        {
          key: 'footer',
          template:
            'Summary by {context.author.name} using {elements.header.metadata.style}\n',
          metadata: { emphasis: 'summary' },
        },
      ],
      [
        'faulty',
        {
          key: 'faulty',
          template: 'This should never render',
          metadata: {},
        },
      ],
    ]);
  });

  it('assembles ordered prompt fragments with placeholder resolution across sources', () => {
    const assembler = new PromptAssembler({
      elements: [
        {
          key: 'header',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('header'),
          promptData,
        },
        {
          key: 'body',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('body'),
          promptData,
        },
        {
          key: 'optional',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('optional'),
          promptData,
        },
        {
          key: 'footer',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('footer'),
          promptData,
        },
      ],
      placeholderResolver,
      allElementsMap: elementDefinitions,
    });

    const { prompt, errors } = assembler.build();

    expect(prompt).toBe(
      [
        '### Chronicles of Integration (v7) ###\n',
        'The assembly combines nested sources.\n',
        'Location: Archive Vault\n',
        'Style: caps\n',
        'Optional hints: \n',
        'Summary by Archivist Elowen using caps\n',
      ].join('')
    );
    expect(errors).toEqual([]);
  });

  it('continues assembling when an element throws and records the failure', () => {
    const assembler = new PromptAssembler({
      elements: [
        {
          key: 'header',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('header'),
          promptData,
        },
        {
          key: 'faulty',
          assembler: new ThrowingElementAssembler(),
          elementConfig: elementDefinitions.get('faulty'),
          promptData,
        },
        {
          key: 'footer',
          assembler: new TemplateElementAssembler(),
          elementConfig: elementDefinitions.get('footer'),
          promptData,
        },
      ],
      placeholderResolver,
      allElementsMap: elementDefinitions,
    });

    const { prompt, errors } = assembler.build();

    expect(prompt).toBe(
      [
        '### Chronicles of Integration (v7) ###\n',
        'Summary by Archivist Elowen using caps\n',
      ].join('')
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('faulty');
    expect(errors[0].error).toBeInstanceOf(Error);
    expect(errors[0].error.message).toBe(
      'Failed to assemble faulty for Chronicles of Integration'
    );
  });

  it('enforces dependency contracts for integration wiring mistakes', () => {
    expect(
      () =>
        new PromptAssembler({
          elements: null,
          placeholderResolver,
          allElementsMap: elementDefinitions,
        })
    ).toThrow('PromptAssembler: `elements` must be a non-empty array.');

    expect(
      () =>
        new PromptAssembler({
          elements: [],
          placeholderResolver: {},
          allElementsMap: elementDefinitions,
        })
    ).toThrow(
      'PromptAssembler: `placeholderResolver` is required and must implement `.resolve()`.'
    );

    expect(
      () =>
        new PromptAssembler({
          elements: [],
          placeholderResolver,
          allElementsMap: [],
        })
    ).toThrow('PromptAssembler: `allElementsMap` must be a Map.');
  });
});
