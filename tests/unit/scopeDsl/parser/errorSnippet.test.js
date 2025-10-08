import generateErrorSnippet, {
  generateErrorSnippet as namedGenerateErrorSnippet,
} from '../../../../src/scopeDsl/parser/errorSnippet.js';

describe('generateErrorSnippet', () => {
  it('returns snippet with caret at provided column for existing line', () => {
    const source = ['const a = 1;', 'const b = 2;'].join('\n');
    const snippet = generateErrorSnippet(source, 2, 8);
    expect(snippet).toBe('const b = 2;\n       ^');
  });

  it('handles column at beginning of line', () => {
    const snippet = generateErrorSnippet('return value;', 1, 1);
    expect(snippet).toBe('return value;\n^');
  });

  it('pads caret when column exceeds line length', () => {
    const snippet = generateErrorSnippet('short', 1, 10);
    expect(snippet).toBe('short\n         ^');
  });

  it('falls back to empty line content when line is out of range', () => {
    const snippet = generateErrorSnippet('first line\nsecond line', 5, 3);
    expect(snippet).toBe('\n  ^');
  });

  it('supports empty source strings', () => {
    const snippet = generateErrorSnippet('', 1, 1);
    expect(snippet).toBe('\n^');
  });

  it('exports the same function as default and named export', () => {
    expect(namedGenerateErrorSnippet).toBe(generateErrorSnippet);
  });
});
