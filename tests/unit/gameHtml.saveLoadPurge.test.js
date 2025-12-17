/**
 * @file Verifies game.html has no save/load UI remnants.
 * @see tickets/REMGAMSAVLOAPER-001-ui-html-css-purge.md
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('game.html save/load UI purge', () => {
  let document;
  let html;

  beforeAll(() => {
    html = fs.readFileSync(path.resolve('./game.html'), 'utf-8');
    const dom = new JSDOM(html);
    document = dom.window.document;
  });

  it('removes save/load buttons and modals from the markup', () => {
    expect(document.querySelector('#open-save-game-button')).toBeNull();
    expect(document.querySelector('#open-load-game-button')).toBeNull();

    expect(document.querySelector('#save-game-screen')).toBeNull();
    expect(document.querySelector('#load-game-screen')).toBeNull();

    expect(document.querySelector('#confirm-save-button')).toBeNull();
    expect(document.querySelector('#confirm-load-button')).toBeNull();
    expect(document.querySelector('#delete-save-button')).toBeNull();
  });

  it('removes load-on-start URL param behavior', () => {
    expect(html).not.toContain("params.get('load')");
    expect(html).not.toContain('game.html?load=true');
  });
});

