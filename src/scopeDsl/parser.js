/**
 * @fileoverview Scope‑DSL Parser — *stable version*
 * @description Recursive‑descent parser for the Scope‑DSL that converts DSL strings into AST objects.
 *              All Jest tests included with the repository pass against this implementation.
 *
 * Key design points
 * ──────────────────
 * • **Deterministic token consumption** – every helper consumes exactly the tokens it owns, no
 *   duplicate or missing `advance()` calls.
 * • **Unified `[` handling** – decisions about `[]` (array iteration) vs. `[{…}]` (filter) live in
 *   **one place**: the loop inside `parseTerm()`. `parseStep()` is concerned solely with parsing a
 *   single field name.
 * • **Depth guard** – expressions may nest at most four field/filter/array levels beyond the source
 *   node (per the test‑suite requirements).
 * • **Comprehensive error reporting** – detailed line/column/snippet via `ScopeSyntaxError`.
 *
 * Public API (unchanged)
 * ──────────────────────
 *   parseScopeFile(content:string, name:string): ScopeDef
 *   parseInlineExpr(expression:string): AST
 *   ScopeSyntaxError class
 */

//────────────────────────────────────────────────────────────────────────────
// Type annotations (JSDoc – kept succinct for readability)
//────────────────────────────────────────────────────────────────────────────
/** @typedef {{type:'ScopeDef',name:string,expr:Object}} ScopeDef */
/** @typedef {{type:'Source',kind:'actor'|'location'|'entities',param?:string|null}} Source */
/** @typedef {{type:'Step',field:string|null,isArray:boolean,parent:Object}} Step */
/** @typedef {{type:'Filter',logic:Object,parent:Object}} Filter */
/** @typedef {{type:'Union',left:Object,right:Object}} Union */
/** @typedef {{type:string,value:string,line:number,column:number}} Token */

class ScopeSyntaxError extends Error {
    /**
     * @param {string} message
     * @param {number} line
     * @param {number} column
     * @param {string} snippet
     */
    constructor(message, line, column, snippet) {
        super(`${message} at line ${line}, column ${column}\n\n${snippet}`);
        this.name = 'ScopeSyntaxError';
        this.line = line;
        this.column = column;
        this.snippet = snippet;
    }
}

//────────────────────────────────────────────────────────────────────────────
// TOKENIZER
//────────────────────────────────────────────────────────────────────────────
class Tokenizer {
    /** @param {string} input */
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        /** @type {Token[]} */
        this.tokens = [];
        this.tokenize();
    }

    tokenize() {
        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            // Whitespace
            if (/\s/.test(ch)) { this.advance(); continue; }
            // Comment (// ...\n)
            if (this.input.startsWith('//', this.pos)) { this.skipComment(); continue; }
            // Identifier / keyword
            if (/[A-Za-z_]/.test(ch)) { this.readIdentifier(); continue; }
            // One‑char tokens & string
            switch (ch) {
                case '(': this.push('LPAREN', '('); break;
                case ')': this.push('RPAREN', ')'); break;
                case '[': this.push('LBRACKET', '['); break;
                case ']': this.push('RBRACKET', ']'); break;
                case '{': this.push('LBRACE', '{'); break;
                case '}': this.push('RBRACE', '}'); break;
                case ',': this.push('COMMA', ','); break;
                case '+': this.push('PLUS', '+'); break;
                case '.': this.push('DOT', '.'); break;
                case ':': this.push('COLON', ':'); break;
                case '!': this.push('BANG', '!'); break;
                case '"': this.readString(); continue; // consumes internally
                default:
                    throw new ScopeSyntaxError(`Unexpected character: '${ch}'`, this.line, this.col, this.snippet());
            }
            this.advance(); // consumed one‑char token
        }
        this.push('EOF', '');
    }

    //────────── helpers ──────────
    skipComment() { while (this.pos < this.input.length && this.input[this.pos] !== '\n') this.advance(); }

    readIdentifier() {
        const startLine = this.line, startCol = this.col, startPos = this.pos;
        while (this.pos < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.pos])) this.advance();
        const value = this.input.slice(startPos, this.pos);
        this.tokens.push({ type: 'IDENTIFIER', value, line: startLine, column: startCol });
    }

    readString() {
        const startLine = this.line, startCol = this.col;
        this.advance(); // skip opening quote
        let value = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
            if (this.input[this.pos] === '\\') { this.advance(); /* escape */ }
            value += this.input[this.pos];
            this.advance();
        }
        if (this.pos >= this.input.length) throw new ScopeSyntaxError('Unterminated string', startLine, startCol, this.snippet(startLine));
        this.advance(); // skip closing quote
        this.tokens.push({ type: 'STRING', value, line: startLine, column: startCol });
    }

    push(type, value) { this.tokens.push({ type, value, line: this.line, column: this.col }); }

    advance() {
        if (this.input[this.pos] === '\n') { this.line++; this.col = 1; } else { this.col++; }
        this.pos++;
    }

    snippet(line = this.line, col = this.col) {
        const l = this.input.split('\n')[line - 1] || '';
        return `${l}\n${' '.repeat(col - 1)}^`;
    }

    /** @returns {Token[]} */ getTokens() { return this.tokens; }
}

//────────────────────────────────────────────────────────────────────────────
// PARSER
//────────────────────────────────────────────────────────────────────────────
class Parser {
    /** @param {string} input */
    constructor(input) {
        this.input = input;
        this.tokens = new Tokenizer(input).getTokens();
        this.current = 0;
    }

    //──────── entry points ────────
    /** @param {string} name @returns {ScopeDef} */
    parseDef(name) {
        const expr = this.parseExpr();
        this.expect('EOF', 'Unexpected tokens after expression');
        return { type: 'ScopeDef', name, expr };
    }

    /** @returns {Object} */
    parseExpr() {
        const left = this.parseTerm();
        if (this.match('PLUS')) { this.advance(); const right = this.parseExpr(); return { type: 'Union', left, right }; }
        return left;
    }

    //──────── term / chain ────────
    parseTerm() {
        let node = this.parseSource(); // starting point
        let depth = 0;                  // number of edges consumed so far

        /* Loop over “.field”, bare “[]”, and filter steps */
        while (this.match('DOT') || this.match('LBRACKET')) {

            /* ───── dot-field access ───── */
            if (this.match('DOT')) {
                depth++;
                if (depth > 4) this.error('Expression depth limit exceeded (max 4)');

                this.advance(); // consume '.'
                const firstTok = this.expect('IDENTIFIER', 'Expected field name');
                let fieldName = firstTok.value;

                // Support identifiers that themselves contain a colon (e.g. core:stats)
                if (this.match('COLON')) {
                    this.advance(); // ':'
                    const secondTok = this.expect('IDENTIFIER', 'Expected identifier after colon');
                    fieldName = `${fieldName}:${secondTok.value}`;
                }

                // Build the Step node
                const stepNode = { type: 'Step', field: fieldName, isArray: false, parent: node };

                // Optional “.entities(core:xyz)” helper directly after a dot-field
                if (fieldName === 'entities' && this.match('LPAREN')) {
                    this.advance();
                    stepNode.param = this.parseComponentId();
                    this.expect('RPAREN', 'Expected closing parenthesis');
                }

                node = stepNode;
                continue;
            }

            /* ───── '[' … either bare array iteration or a filter ───── */
            this.advance(); // we're sitting just after '['

            if (this.match('RBRACKET')) {
                /* bare []  → does *NOT* count toward depth limit */
                this.advance(); // consume ']'

                if (node.type === 'Step') node.isArray = true;
                else node = { type: 'Step', field: null, isArray: true, parent: node };

                continue;
            }

            /* otherwise it's a filter: counts as an edge */
            depth++;
            if (depth > 4) this.error('Expression depth limit exceeded (max 4)');

            const filterNode = this.parseFilter(); // parses JSON-Logic + closing ']'
            filterNode.parent = node;
            node = filterNode;
        }
        return node;
    }

    //──────── source nodes ────────
    parseSource() {
        const idTok = this.expect('IDENTIFIER', 'Expected source node (actor, location, or entities)');
        switch (idTok.value) {
            case 'actor': return { type: 'Source', kind: 'actor' };
            case 'location': return this.parseLocationSource();
            case 'entities': return this.parseEntitiesSource();
            default: this.error(`Unknown source node: '${idTok.value}'`);
        }
    }

    parseLocationSource() {
        let param = null;
        if (this.match('LPAREN')) {
            this.advance();
            param = this.parseEntityReference();
            this.expect('RPAREN', 'Expected closing parenthesis');
        }
        return { type: 'Source', kind: 'location', param };
    }

    parseEntitiesSource() {
        this.expect('LPAREN', 'Expected opening parenthesis');
        const id = this.parseComponentId();
        this.expect('RPAREN', 'Expected closing parenthesis');
        return { type: 'Source', kind: 'entities', param: id };
    }

    //──────── filter / JSON logic ────────
    parseFilter() {
        const obj = this.parseJsonLogic();
        this.expect('RBRACKET', 'Expected closing bracket for filter');
        return { type: 'Filter', logic: obj };
    }

    parseJsonLogic() {
        this.expect('LBRACE', 'Expected opening brace for JSON Logic object');
        const obj = {};
        while (!this.match('RBRACE')) {
            const keyTok = this.expect('STRING', 'Expected string key in JSON Logic object');
            this.expect('COLON', 'Expected colon after key');
            obj[keyTok.value] = this.parseJsonValue();
            if (this.match('COMMA')) { this.advance(); } else break;
        }
        this.expect('RBRACE', 'Expected closing brace for JSON Logic object');
        return obj;
    }

    parseJsonValue() {
        if (this.match('STRING')) return this.advance().value;
        if (this.match('IDENTIFIER')) {
            const v = this.advance().value;
            if (v === 'true') return true; if (v === 'false') return false; return v;
        }
        if (this.match('LBRACKET')) return this.parseJsonArray();
        if (this.match('LBRACE')) return this.parseJsonLogic();
        this.error('Expected JSON value (string, identifier, array, or object)');
    }

    parseJsonArray() {
        this.expect('LBRACKET', 'Expected opening bracket for array');
        const arr = [];
        while (!this.match('RBRACKET')) {
            arr.push(this.parseJsonValue());
            if (this.match('COMMA')) this.advance(); else break;
        }
        this.expect('RBRACKET', 'Expected closing bracket for array');
        return arr;
    }

    //──────── misc helpers ────────
    parseEntityReference() { return this.expect('IDENTIFIER', 'Expected entity reference').value; }

    parseComponentId() {
        // Support optional leading '!'
        let negate = false;
        if (this.match('BANG')) {
            this.advance();
            negate = true;
        }
        const first = this.expect('IDENTIFIER', 'Expected component identifier').value;
        if (first.includes(':')) return negate ? '!' + first : first; // modern one‑token form
        if (this.match('COLON')) { this.advance(); const second = this.expect('IDENTIFIER', 'Expected component name').value; return negate ? `!${first}:${second}` : `${first}:${second}`; }
        this.error('Expected colon in component ID');
    }

    //──────── token utility ────────
    peek() { return this.tokens[this.current] || { type: 'EOF', value: '', line: 0, column: 0 }; }
    previous() { return this.tokens[this.current - 1]; }
    isAtEnd() { return this.peek().type === 'EOF'; }
    match(type) { return this.peek().type === type; }
    advance() { if (!this.isAtEnd()) this.current++; return this.previous(); }
    expect(type, msg) { if (this.match(type)) return this.advance(); this.error(msg); }

    //──────── error helpers ────────
    error(msg) { const t = this.peek(); throw new ScopeSyntaxError(msg, t.line, t.column, this.snippet(t)); }
    snippet(t) { const lineStr = this.input.split('\n')[t.line - 1] || ''; return `${lineStr}\n${' '.repeat(t.column - 1)}^`; }
}

//────────────────────────────────────────────────────────────────────────────
// Convenience wrappers (public API)
//────────────────────────────────────────────────────────────────────────────
function parseScopeFile(content, name) {
    const p = new Parser(content.trim());
    return p.parseDef(name);
}

function parseInlineExpr(expr) {
    const p = new Parser(expr.trim());
    const e = p.parseExpr();
    p.expect('EOF', 'Unexpected tokens after expression');
    return e;
}

module.exports = { parseScopeFile, parseInlineExpr, ScopeSyntaxError };
