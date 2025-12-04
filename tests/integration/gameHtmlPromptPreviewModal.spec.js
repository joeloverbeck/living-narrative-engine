import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const readFixture = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');

describe('game.html Prompt Preview modal', () => {
  const gameHtmlPath = path.join(__dirname, '..', '..', 'game.html');
  let gameHtml;

  beforeAll(() => {
    gameHtml = fs.readFileSync(gameHtmlPath, 'utf8');
  });

  it('includes the metadata fields required by PromptPreviewModal', () => {
    const dom = new JSDOM(gameHtml);
    const { document } = dom.window;

    const metadataContainer = document.querySelector('#llm-prompt-debug-metadata');
    const metaActor = document.querySelector('#llm-prompt-meta-actor');
    const metaLlm = document.querySelector('#llm-prompt-meta-llm');
    const metaActions = document.querySelector('#llm-prompt-meta-actions');

    expect(metadataContainer).not.toBeNull();
    expect(metaActor).not.toBeNull();
    expect(metaLlm).not.toBeNull();
    expect(metaActions).not.toBeNull();

    expect(metadataContainer.contains(metaActor)).toBe(true);
    expect(metadataContainer.contains(metaLlm)).toBe(true);
    expect(metadataContainer.contains(metaActions)).toBe(true);
  });

  it('uses a wide modal layout suitable for long prompts', () => {
    const styles = [
      readFixture('css/components/_modals.css'),
      readFixture('css/components/_llm-prompt-debug.css'),
    ].join('\n');

    const dom = new JSDOM(
      `
        <div id="llm-prompt-debug-modal" class="modal-overlay">
          <div class="modal-content"></div>
        </div>
      `,
      { pretendToBeVisual: true }
    );

    const { document } = dom.window;
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const modalContent = document.querySelector('#llm-prompt-debug-modal .modal-content');
    const computedStyles = dom.window.getComputedStyle(modalContent);
    const maxWidth = parseFloat(computedStyles.maxWidth);

    expect(maxWidth).toBeGreaterThanOrEqual(900);
  });
});
