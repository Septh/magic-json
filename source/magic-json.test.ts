import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import MJ, { type Metadata } from './magic-json.js'

type IndentationPattern = [ indent: string, description: string, eol: string ]

/**
 * Turns an array of indentation patterns into a proper JSON string
 * that can be passed to `MagicJSON.parse()`.
 */
function toJson(patterns: IndentationPattern[], open = '\n', close = open): string {
    const last = patterns.length - 1
    return [
        '{' + open,
        patterns.map(([ indent, description, eol ], index) => {
            return index < last
                ? `${indent}"key${index}": "${description}",${eol}`
                : `${indent}"key${last }": "${description}"${eol}`
        }).join(''),
        close + '}'
    ].join('')
}

/**
 * Parses a JSON string with `MagicJSON.parse()` and returns the object and its metadata.
 */
function parse(text: string): {obj: any, meta: Metadata } {
    const obj = MJ.parse(text)
    const sym = Object.getOwnPropertySymbols(obj)[0]
    return {
        obj,
        meta: obj[sym]
    }
}

describe('Indentation', () => {

    test('detect regular space indent', () => {
        const indents: IndentationPattern[] = [
            [ '  ',     '2 spaces', '\n' ],
            [ '    ',   '4 spaces', '\n' ],
            [ '      ', '6 spaces', '\n' ],
            [ '    ',   '4 spaces', '\n' ],
            [ '  ',     '2 spaces', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indentString, '  ')
    })

    test('detect regular tab indent', () => {
        const indents: IndentationPattern[] = [
            [ '\t',     '1 tab',  '\n' ],
            [ '\t\t',   '2 tabs', '\n' ],
            [ '\t\t\t', '3 tabs', '\n' ],
            [ '\t\t',   '2 tabs', '\n' ],
            [ '\t',     '1 tab',  '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indentString, '\t')
    })

    test('detect more spaces than tabs as space indent', () => {
        const indents: IndentationPattern[] = [
            [ '  ',   '2 spaces', '\n' ],
            [ '    ', '4 spaces', '\n' ],
            [ '\t',   '1 tab',    '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indentString, '  ')
    })

    test('detect more tabs than spaces as tab indent', () => {
        const indents: IndentationPattern[] = [
            [ '\t',   '1 tab',    '\n' ],
            [ '\t\t', '1 tab',    '\n' ],
            [ '  ',   '2 spaces', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indentString, '\t')
    })

    test('detect no indent', () => {
        const indents: IndentationPattern[] = [
            [ '', 'no indent', '\n' ],
            [ '', 'no indent', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indentString, undefined)
    })
})

describe('Line endings', () => {

    test('detect regular LF line endings', () => {
        const indents: IndentationPattern[] = [
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.useCRLF, false)
    })

    test('detect regular CRLF line endings', () => {
        const indents: IndentationPattern[] = [
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
        ]
        const { meta } = parse(toJson(indents, '\r\n'))
        assert.equal(meta.useCRLF, true)
    })

    test('detect mixed LF and CRLF line endings', () => {
        const indents: IndentationPattern[] = [
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'LF ending',   '\n'   ],
            [ '  ', 'CRLF ending', '\r\n' ],
        ]
        const { meta } = parse(toJson(indents, '\r\n'))
        assert.equal(meta.useCRLF, true)
    })
})
