// tests/prompting/promptBuilder.emptySections.test.js

import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
// … other imports …

describe('PromptBuilder – missing notesArray/goalsArray', () => {
  let promptBuilder;
  let logger;
  let llmConfigService;
  let placeholderResolver;
  let standardElementAssembler;
  let perceptionLogAssembler;
  let thoughtsSectionAssembler;
  let notesSectionAssembler;
  let goalsSectionAssembler;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    llmConfigService = {
      getConfig: jest.fn().mockResolvedValue({
        configId: 'test',
        promptElements: [],
        promptAssemblyOrder: [],
      }),
    };
    placeholderResolver = { resolve: (s) => s };
    standardElementAssembler = { assemble: jest.fn().mockReturnValue('') };
    perceptionLogAssembler = { assemble: jest.fn().mockReturnValue('') };
    thoughtsSectionAssembler = { assemble: jest.fn().mockReturnValue('') };
    notesSectionAssembler = { assemble: jest.fn().mockReturnValue('') };
    goalsSectionAssembler = { assemble: jest.fn().mockReturnValue('') };

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler,
      perceptionLogAssembler,
      thoughtsSectionAssembler,
      notesSectionAssembler,
      goalsSectionAssembler,
      indexedChoicesAssembler: new IndexedChoicesAssembler({ logger }),
    });
  });

  it('build() with empty promptData should not inject notes or goals sections', async () => {
    const output = await promptBuilder.build('test', {});
    expect(output).toBe('');
    expect(notesSectionAssembler.assemble).not.toHaveBeenCalled();
    expect(goalsSectionAssembler.assemble).not.toHaveBeenCalled();
  });
});
