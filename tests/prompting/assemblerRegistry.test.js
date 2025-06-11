import { describe, beforeEach, test, expect } from '@jest/globals';
import { AssemblerRegistry } from '../../src/prompting/assemblerRegistry.js';

class Dummy {
  assemble() {}
}

describe('AssemblerRegistry', () => {
  let reg;

  beforeEach(() => {
    reg = new AssemblerRegistry();
  });

  test('register & resolve happy path', () => {
    const asm = new Dummy();
    reg.register('foo', asm);
    expect(reg.resolve('foo')).toBe(asm);
  });

  test('register rejects invalid key', () => {
    expect(() => reg.register('', new Dummy())).toThrow('invalid key');
    expect(() => reg.register(123, new Dummy())).toThrow('invalid key');
  });

  test('register rejects invalid assembler', () => {
    expect(() => reg.register('bar', {})).toThrow(
      'assembler must implement assemble'
    );
  });

  test('resolve unknown key throws', () => {
    expect(() => reg.resolve('no-such')).toThrow(
      "No assembler registered for 'no-such'"
    );
  });
});
