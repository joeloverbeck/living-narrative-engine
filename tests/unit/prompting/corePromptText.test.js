import { beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const corePromptTextPath = path.resolve(
  process.cwd(),
  'data/prompts/corePromptText.json'
);

describe('corePromptText mood update fields', () => {
  let corePromptText;

  beforeAll(() => {
    const jsonContent = fs.readFileSync(corePromptTextPath, 'utf-8');
    corePromptText = JSON.parse(jsonContent);
  });

  test('mood update task definition uses character name placeholder', () => {
    expect(corePromptText.moodUpdateTaskDefinitionText).toContain(
      '[CHARACTER_NAME]'
    );
  });

  test('mood update portrayal guidelines omit speech guidance', () => {
    expect(corePromptText.moodUpdatePortrayalGuidelinesTemplate).toContain(
      '{{name}}'
    );
    expect(corePromptText.moodUpdatePortrayalGuidelinesTemplate).not.toContain(
      'Speech Style'
    );
  });

  test('mood update instruction text includes character lens guidance', () => {
    expect(corePromptText.moodUpdateOnlyInstructionText).toContain(
      'CHARACTER LENS'
    );
    expect(corePromptText.moodUpdateOnlyInstructionText).toContain(
      '[CHARACTER_NAME]'
    );
  });
});
