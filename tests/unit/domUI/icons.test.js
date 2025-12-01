import { describe, it, expect, afterEach } from '@jest/globals';
import {
  IconRegistry,
  getIcon,
  setIconRegistry,
} from '../../../src/domUI/icons.js';

const THOUGHTS_FALLBACK = '<svg';
const NOTES_FALLBACK = '<svg';
const COPY_ALL_FALLBACK = '<svg';

describe('getIcon', () => {
  afterEach(() => {
    setIconRegistry(null);
  });

  it('returns fallback icons when registry is not set', () => {
    expect(getIcon('thoughts')).toContain(THOUGHTS_FALLBACK);
    expect(getIcon('notes')).toContain(NOTES_FALLBACK);
    expect(getIcon('copy-all')).toContain(COPY_ALL_FALLBACK);
  });

  it('retrieves icons from the registry when available', () => {
    const registry = {
      get: (type, id) => {
        if (type === 'ui-icons' && id === 'notes') return '<svg id="n" />';
        if (type === 'ui-icons' && id === 'thoughts') return '<svg id="t" />';
        if (type === 'ui-icons' && id === 'copy-all')
          return '<svg id="copy-all" />';
        return undefined;
      },
    };
    setIconRegistry(registry);
    expect(getIcon('notes')).toBe('<svg id="n" />');
    expect(getIcon('thoughts')).toBe('<svg id="t" />');
    expect(getIcon('copy-all')).toBe('<svg id="copy-all" />');
  });

  it('falls back when registry lookup fails', () => {
    const registry = { get: () => undefined };
    setIconRegistry(registry);
    expect(getIcon('thoughts')).toContain(THOUGHTS_FALLBACK);
    expect(getIcon('copy-all')).toContain(COPY_ALL_FALLBACK);
  });

  it('supports registry responses that provide markup objects', () => {
    const registry = {
      get: (type, id) => {
        if (type === 'ui-icons' && id === 'copy-all') {
          return { markup: '<svg id="copy-all-object" />' };
        }
        return undefined;
      },
    };

    setIconRegistry(registry);

    expect(getIcon('copy-all')).toBe('<svg id="copy-all-object" />');
  });

  it('returns an empty string when no fallback icon exists', () => {
    setIconRegistry(null);
    expect(getIcon('non-existent-icon')).toBe('');
  });
});

describe('IconRegistry', () => {
  it('stores the provided registry and defers to it for lookups', () => {
    const instance = new IconRegistry();
    const registry = { get: () => '<svg id="custom" />' };

    instance.setRegistry(registry);

    expect(instance.getIcon('anything')).toBe('<svg id="custom" />');
  });

  it('falls back to built-in icons when the registry returns unexpected values', () => {
    const instance = new IconRegistry();

    instance.setRegistry({
      get: (type, id) => {
        if (type === 'ui-icons' && id === 'thoughts') {
          return { markup: 42 };
        }
        if (type === 'ui-icons' && id === 'copy-all') {
          return { markup: null };
        }
        return null;
      },
    });

    expect(instance.getIcon('thoughts')).toContain(THOUGHTS_FALLBACK);
    expect(instance.getIcon('copy-all')).toContain(COPY_ALL_FALLBACK);
  });
});
