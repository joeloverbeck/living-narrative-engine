/** @jest-environment node */
// src/tests/domUI/documentContext.node.test.js

/**
 * These tests run in the raw Node environment where neither `window`
 * nor `document` exist. That lets us verify how DocumentContext behaves
 * when it cannot obtain a DOM, without breaking the JSDOM instance used
 * by the rest of the suite.
 */

import {describe, it, expect, jest} from '@jest/globals';
import DocumentContext from '../../src/domUI/documentContext.js';

describe('DocumentContext (no DOM available)', () => {

    it('sets internal context to null and logs an error', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const ctx = new DocumentContext();          // global.document is undefined here
        expect(ctx.document).toBeNull();
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('Could not determine a valid document context')
        );
    });

    it('query() returns null and warns', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const ctx = new DocumentContext();
        expect(ctx.query('#foo')).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining("query('#foo') attempted, but no document context is available")
        );
    });

    it('create() returns null and warns', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const ctx = new DocumentContext();
        expect(ctx.create('div')).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining("create('div') attempted, but no document context is available")
        );
    });
});