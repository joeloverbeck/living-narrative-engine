import { describe, it, expect, afterEach } from '@jest/globals';
import { getIcon, setIconRegistry } from '../../src/domUI/icons.js';

const THOUGHTS_FALLBACK = '<svg';
const NOTES_FALLBACK = '<svg';

describe('getIcon', () => {
  afterEach(() => {
    setIconRegistry(null);
  });

  it('returns fallback icons when registry is not set', () => {
    expect(getIcon('thoughts')).toContain(THOUGHTS_FALLBACK);
    expect(getIcon('notes')).toContain(NOTES_FALLBACK);
  });

  it('retrieves icons from the registry when available', () => {
    const registry = {
      get: (type, id) => {
        if (type === 'ui-icons' && id === 'notes') return '<svg id="n" />';
        if (type === 'ui-icons' && id === 'thoughts') return '<svg id="t" />';
        return undefined;
      },
    };
    setIconRegistry(registry);
    expect(getIcon('notes')).toBe('<svg id="n" />');
    expect(getIcon('thoughts')).toBe('<svg id="t" />');
  });

  it('falls back when registry lookup fails', () => {
    const registry = { get: () => undefined };
    setIconRegistry(registry);
    expect(getIcon('thoughts')).toContain(THOUGHTS_FALLBACK);
  });
});
