/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

describe('location character portrait styles', () => {
  const cssPath = path.join(
    process.cwd(),
    'css',
    'components',
    '_location-info.css'
  );

  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('uses a cover fit and warm background to avoid letterboxing gaps', () => {
    const portraitRule = cssContent.match(/\.character-portrait\s*{[\s\S]*?}/);

    expect(portraitRule).toBeTruthy();
    expect(portraitRule?.[0]).toContain('object-fit: cover');
    expect(portraitRule?.[0]).toContain('object-position: center');
    expect(portraitRule?.[0]).toContain('background: var(--panel-bg-color);');
  });
});
