import { describe, beforeAll, test, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../data/schemas/status-effect.registry.schema.json';
import anatomyRegistry from '../../../data/mods/anatomy/status-effects/status-effects.registry.json';

describe('status-effect.registry schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(schema);
  });

  test('anatomy registry file conforms to schema', () => {
    const ok = validate(anatomyRegistry);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });

  test('rejects registry missing effectType-specific defaults', () => {
    const invalid = {
      id: 'core:status_effects',
      effects: [
        {
          id: 'bleeding',
          effectType: 'bleed',
          componentId: 'anatomy:bleeding',
          startedEventId: 'anatomy:bleeding_started',
        },
      ],
    };

    const ok = validate(invalid);
    expect(ok).toBe(false);
  });
});
