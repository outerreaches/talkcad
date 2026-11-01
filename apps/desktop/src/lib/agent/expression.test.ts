import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './expression';

describe('evaluateExpression', () => {
  it('evaluates arithmetic with precedence', () => {
    expect(evaluateExpression('2 + 3 * 4').value).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4').value).toBe(20);
    expect(evaluateExpression('10 / 4').value).toBe(2.5);
    expect(evaluateExpression('10 % 4').value).toBe(2);
  });

  it('handles unary minus and right-associative powers', () => {
    expect(evaluateExpression('-5 + 2').value).toBe(-3);
    expect(evaluateExpression('2 ^ 3 ^ 2').value).toBe(512);
  });

  it('uses context variables', () => {
    const result = evaluateExpression('width * 2 + wall', { width: 30, wall: 2 });
    expect(result.value).toBe(62);
  });

  it('supports a fixed function set and constants', () => {
    expect(evaluateExpression('sqrt(16)').value).toBe(4);
    expect(evaluateExpression('max(3, 7, 5)').value).toBe(7);
    expect(evaluateExpression('round(pi * 100) / 100').value).toBe(3.14);
  });

  it('rejects identifiers that are not in scope', () => {
    const result = evaluateExpression('constructor');
    expect(result.error).toMatch(/Unknown identifier/);
    expect(Number.isNaN(result.value)).toBe(true);
  });

  it('rejects property access and calls on arbitrary names', () => {
    expect(evaluateExpression('this.process').error).toBeDefined();
    expect(evaluateExpression('constructor(1)').error).toMatch(/Unknown function/);
  });

  it('rejects strings, brackets and semicolons', () => {
    expect(evaluateExpression('"a"').error).toBeDefined();
    expect(evaluateExpression('a[0]').error).toBeDefined();
    expect(evaluateExpression('1;2').error).toBeDefined();
  });

  it('reports non-finite results as errors', () => {
    const result = evaluateExpression('1 / 0');
    expect(Number.isNaN(result.value)).toBe(true);
    expect(result.error).toMatch(/finite/);
  });

  it('rejects empty input', () => {
    expect(evaluateExpression('   ').error).toMatch(/Empty/);
  });
});
