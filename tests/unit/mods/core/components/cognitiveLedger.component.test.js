/**
 * @file Tests for the core:cognitive_ledger component schema validation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import cognitiveLedgerComponent from '../../../../../data/mods/core/components/cognitive_ledger.component.json';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('core:cognitive_ledger component', () => {
  describe('component definition', () => {
    it('has standard component schema reference', () => {
      expect(cognitiveLedgerComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct id', () => {
      expect(cognitiveLedgerComponent.id).toBe('core:cognitive_ledger');
    });

    it('defines an object data schema', () => {
      expect(cognitiveLedgerComponent.dataSchema.type).toBe('object');
    });

    it('requires settled_conclusions and open_questions', () => {
      expect(cognitiveLedgerComponent.dataSchema.required).toEqual([
        'settled_conclusions',
        'open_questions',
      ]);
    });

    it('limits settled_conclusions to 3 items', () => {
      expect(
        cognitiveLedgerComponent.dataSchema.properties.settled_conclusions
          .maxItems
      ).toBe(3);
    });

    it('limits open_questions to 3 items', () => {
      expect(
        cognitiveLedgerComponent.dataSchema.properties.open_questions.maxItems
      ).toBe(3);
    });

    it('requires non-empty strings for settled_conclusions items', () => {
      expect(
        cognitiveLedgerComponent.dataSchema.properties.settled_conclusions.items
          .minLength
      ).toBe(1);
    });

    it('requires non-empty strings for open_questions items', () => {
      expect(
        cognitiveLedgerComponent.dataSchema.properties.open_questions.items
          .minLength
      ).toBe(1);
    });

    it('does not allow additional properties', () => {
      expect(cognitiveLedgerComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });
  });

  describe('schema validation', () => {
    let testBed;

    beforeEach(() => {
      testBed = new TestBedClass();
    });

    afterEach(() => {
      testBed.cleanup();
    });

    const validate = (data) =>
      testBed.validateAgainstSchema(data, 'core:cognitive_ledger');

    it('accepts empty arrays for both fields', () => {
      const result = validate({
        settled_conclusions: [],
        open_questions: [],
      });
      expect(result.isValid).toBe(true);
    });

    it('rejects missing settled_conclusions', () => {
      const result = validate({ open_questions: [] });
      expect(result.isValid).toBe(false);
    });

    it('rejects missing open_questions', () => {
      const result = validate({ settled_conclusions: [] });
      expect(result.isValid).toBe(false);
    });

    it('rejects additional properties', () => {
      const result = validate({
        settled_conclusions: [],
        open_questions: [],
        extra: true,
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects empty strings in settled_conclusions', () => {
      const result = validate({
        settled_conclusions: [''],
        open_questions: [],
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects empty strings in open_questions', () => {
      const result = validate({
        settled_conclusions: [],
        open_questions: [''],
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects settled_conclusions above maxItems', () => {
      const result = validate({
        settled_conclusions: ['a', 'b', 'c', 'd'],
        open_questions: [],
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects open_questions above maxItems', () => {
      const result = validate({
        settled_conclusions: [],
        open_questions: ['a', 'b', 'c', 'd'],
      });
      expect(result.isValid).toBe(false);
    });
  });
});
