import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from '@jest/globals';

describe('LLM Prompt Debug Panel Markup (LLMPRODEBPAN-001)', () => {
  let document;
  let cssContent;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '..', '..', '..', 'game.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(html);
    document = dom.window.document;

    const cssPath = path.join(__dirname, '..', '..', '..', 'css', 'style.css');
    cssContent = fs.readFileSync(cssPath, 'utf-8');
  });

  test('Widget should be present in the right pane', () => {
    const rightPane = document.querySelector('#right-pane');
    const widget = document.querySelector('#llm-prompt-debug-widget');

    expect(rightPane).not.toBeNull();
    expect(widget).not.toBeNull();
    expect(rightPane.contains(widget)).toBe(true);

    // Check if it's before game-actions-widget (as per ticket)
    // This is a bit loose, just checking if both exist
    const gameActionsWidget = document.querySelector('#game-actions-widget');
    expect(gameActionsWidget).not.toBeNull();

    // Ideally check order
    const children = Array.from(rightPane.children);
    const debugIndex = children.indexOf(widget);
    const actionsIndex = children.indexOf(gameActionsWidget);
    expect(debugIndex).toBeLessThan(actionsIndex);
  });

  test('Widget should contain the debug button', () => {
    const button = document.querySelector('#llm-prompt-debug-button');
    expect(button).not.toBeNull();
    expect(button.textContent.trim()).toBe('Prompt to LLM');
    expect(button.classList.contains('menu-button')).toBe(true);
  });

  test('Modal should be present in the body', () => {
    const modal = document.querySelector('#llm-prompt-debug-modal');
    expect(modal).not.toBeNull();
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
  });

  test('Modal should contain required elements', () => {
    const modal = document.querySelector('#llm-prompt-debug-modal');

    const title = modal.querySelector('#llm-prompt-debug-title');
    expect(title).not.toBeNull();
    expect(title.textContent.trim()).toBe('LLM Prompt Preview');

    const content = modal.querySelector('#llm-prompt-debug-content');
    expect(content).not.toBeNull();
    expect(content.tagName).toBe('PRE');

    const metadata = modal.querySelector('#llm-prompt-debug-metadata');
    expect(metadata).not.toBeNull();

    const copyButton = modal.querySelector('#llm-prompt-copy-button');
    expect(copyButton).not.toBeNull();

    const closeButton = modal.querySelector('#llm-prompt-debug-close-button');
    expect(closeButton).not.toBeNull();
  });

  test('style.css should import the new component css', () => {
    expect(cssContent).toContain(
      "@import url('components/_llm-prompt-debug.css');"
    );
  });
});
