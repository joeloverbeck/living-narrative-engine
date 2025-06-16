// tests/accessibility/index.test.js
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from '@jest/globals';

describe('Accessibility: <ul id="message-list">', () => {
  let document;

  beforeAll(() => {
    // Adjust path if your game.html lives elsewhere
    const htmlPath = path.resolve(__dirname, '../../game.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(html);
    document = dom.window.document;
  });

  test('has aria-live="polite"', () => {
    const list = document.querySelector('#message-list');
    expect(list).not.toBeNull();
    expect(list.getAttribute('aria-live')).toBe('polite');
  });
});
