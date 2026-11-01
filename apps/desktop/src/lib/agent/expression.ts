/**
 * Tiny arithmetic expression evaluator.
 *
 * Replaces `new Function(...)` for spec values coming back from the model.
 * Supports numbers, named variables from the context, basic constants and a
 * fixed function set — nothing that can reach a property or a constructor.
 */

export interface ExpressionResult {
  value: number;
  error?: string;
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  sqrt: Math.sqrt,
  pow: Math.pow,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan2: Math.atan2,
  log: Math.log,
  exp: Math.exp,
  hypot: Math.hypot,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) { i += 1; continue; }

    if (/[0-9.]/.test(ch)) {
      const match = /^\d*\.?\d+/.exec(input.slice(i));
      if (!match) throw new Error(`Invalid number at position ${i}`);
      tokens.push({ kind: 'number', value: Number(match[0]) });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i));
      if (!match) throw new Error(`Invalid identifier at position ${i}`);
      tokens.push({ kind: 'ident', value: match[0] });
      i += match[0].length;
      continue;
    }

    if ('+-*/%^'.includes(ch)) { tokens.push({ kind: 'op', value: ch }); i += 1; continue; }
    if (ch === '(') { tokens.push({ kind: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i += 1; continue; }
    if (ch === ',') { tokens.push({ kind: 'comma' }); i += 1; continue; }

    throw new Error(`Unexpected character "${ch}" at position ${i}`);
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[], private readonly vars: Record<string, number>) {}

  parse(): number {
    const value = this.parseExpression();
    if (this.index !== this.tokens.length) {
      throw new Error('Unexpected trailing input');
    }
    return value;
  }

  private peek(): Token | null {
    return this.tokens[this.index] ?? null;
  }

  private next(): Token {
    const token = this.tokens[this.index];
    if (!token) throw new Error('Unexpected end of expression');
    this.index += 1;
    return token;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
        this.next();
        const rhs = this.parseTerm();
        value = token.value === '+' ? value + rhs : value - rhs;
        continue;
      }
      return value;
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'op' && (token.value === '*' || token.value === '/' || token.value === '%')) {
        this.next();
        const rhs = this.parseUnary();
        if (token.value === '*') value *= rhs;
        else if (token.value === '/') value /= rhs;
        else value %= rhs;
        continue;
      }
      return value;
    }
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
      this.next();
      const value = this.parseUnary();
      return token.value === '-' ? -value : value;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token?.kind === 'op' && token.value === '^') {
      this.next();
      const exponent = this.parseUnary(); // right associative
      return Math.pow(base, exponent);
    }
    return base;
  }

  private parsePrimary(): number {
    const token = this.next();

    if (token.kind === 'number') return token.value;

    if (token.kind === 'lparen') {
      const value = this.parseExpression();
      const close = this.next();
      if (close.kind !== 'rparen') throw new Error('Missing closing parenthesis');
      return value;
    }

    if (token.kind === 'ident') {
      const following = this.peek();
      if (following?.kind === 'lparen') {
        const fn = Object.prototype.hasOwnProperty.call(FUNCTIONS, token.value)
          ? FUNCTIONS[token.value]
          : undefined;
        if (!fn) throw new Error(`Unknown function "${token.value}"`);
        this.next(); // consume '('
        const args: number[] = [];
        if (this.peek()?.kind !== 'rparen') {
          for (;;) {
            args.push(this.parseExpression());
            const separator = this.peek();
            if (separator?.kind === 'comma') { this.next(); continue; }
            break;
          }
        }
        const close = this.next();
        if (close.kind !== 'rparen') throw new Error('Missing closing parenthesis');
        return fn(...args);
      }

      if (Object.prototype.hasOwnProperty.call(this.vars, token.value)) return this.vars[token.value];
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, token.value)) return CONSTANTS[token.value];
      throw new Error(`Unknown identifier "${token.value}"`);
    }

    throw new Error('Unexpected token in expression');
  }
}

export function evaluateExpression(expression: string, context?: Record<string, number>): ExpressionResult {
  try {
    const source = String(expression ?? '').trim();
    if (!source) return { value: NaN, error: 'Empty expression' };

    const vars: Record<string, number> = {};
    for (const [key, raw] of Object.entries(context || {})) {
      const value = Number(raw);
      if (Number.isFinite(value)) vars[key] = value;
    }

    const value = new Parser(tokenize(source), vars).parse();
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { value: NaN, error: 'Expression did not evaluate to a finite number' };
    }
    return { value };
  } catch (error) {
    return { value: NaN, error: error instanceof Error ? error.message : String(error) };
  }
}
