import fs from 'fs';
import path from 'path';
import { describe, expect, test, beforeAll } from '@jest/globals';

describe('Expression Messages CSS (EXPCHAPANREN-001)', () => {
  let styleContent;
  let componentContent;

  beforeAll(() => {
    const stylePath = path.join(__dirname, '..', '..', '..', 'css', 'style.css');
    styleContent = fs.readFileSync(stylePath, 'utf-8');

    const componentPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'css',
      'components',
      '_expression-messages.css'
    );
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  test('style.css should import the expression messages component', () => {
    expect(styleContent).toContain(
      "@import url('components/_expression-messages.css');"
    );
  });

  test('expression messages component defines base styling and animation', () => {
    expect(componentContent).toContain('.expression-message');
    expect(componentContent).toContain('@keyframes expressionFadeIn');
    expect(componentContent).toContain('prefers-reduced-motion');
  });

  test('expression messages component defines tag-based modifiers', () => {
    expect(componentContent).toContain('.expression-message--default');
    expect(componentContent).toContain('.expression-message--anger');
    expect(componentContent).toContain('.expression-message--affection');
    expect(componentContent).toContain('.expression-message--loss');
    expect(componentContent).toContain('.expression-message--threat');
    expect(componentContent).toContain('.expression-message--agency');
    expect(componentContent).toContain('.expression-message--attention');
  });
});
