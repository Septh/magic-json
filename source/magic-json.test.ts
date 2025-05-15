import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import MJ from './magic-json.js'

interface Metadata {
    indent: string | undefined
    crlf: boolean
    eof: boolean
    filepath?: string
}

type IndentPattern = [ indent: string, description: string, eol: string ]

/**
 * Turns an array of indent patterns into a proper JSON string
 * that can be passed to `MagicJSON.parse()`.
 */
function toJson(patterns: IndentPattern[], open = '\n', close = open): string {
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
        const indents: IndentPattern[] = [
            [ '  ',     '2 spaces', '\n' ],
            [ '    ',   '4 spaces', '\n' ],
            [ '      ', '6 spaces', '\n' ],
            [ '    ',   '4 spaces', '\n' ],
            [ '  ',     '2 spaces', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indent, '  ')
    })

    test('detect regular tab indent', () => {
        const indents: IndentPattern[] = [
            [ '\t',     '1 tab',  '\n' ],
            [ '\t\t',   '2 tabs', '\n' ],
            [ '\t\t\t', '3 tabs', '\n' ],
            [ '\t\t',   '2 tabs', '\n' ],
            [ '\t',     '1 tab',  '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indent, '\t')
    })

    test('detect more space than tab as space', () => {
        const indents: IndentPattern[] = [
            [ '  ',   '2 spaces', '\n' ],
            [ '    ', '4 spaces', '\n' ],
            [ '\t',   '1 tab',    '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indent, '  ')
    })

    test('detect more tab than space as tab', () => {
        const indents: IndentPattern[] = [
            [ '\t',   '1 tab',    '\n' ],
            [ '\t\t', '1 tab',    '\n' ],
            [ '  ',   '2 spaces', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indent, '\t')
    })

    test('detect no indent', () => {
        const indents: IndentPattern[] = [
            [ '', 'no indent', '\n' ],
            [ '', 'no indent', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.indent, undefined)
    })
})

describe('Line endings', () => {

    test('detect regular LF line endings', () => {
        const indents: IndentPattern[] = [
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
            [ '  ', 'LF ending', '\n' ],
        ]
        const { meta } = parse(toJson(indents))
        assert.equal(meta.crlf, false)
    })

    test('detect regular CRLF line endings', () => {
        const indents: IndentPattern[] = [
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'CRLF ending', '\r\n' ],
        ]
        const { meta } = parse(toJson(indents, '\r\n'))
        assert.equal(meta.crlf, true)
    })

    test('detect mixed LF and CRLF line endings', () => {
        const indents: IndentPattern[] = [
            [ '  ', 'CRLF ending', '\r\n' ],
            [ '  ', 'LF ending',   '\n'   ],
            [ '  ', 'CRLF ending', '\r\n' ],
        ]
        const { meta } = parse(toJson(indents, '\r\n'))
        assert.equal(meta.crlf, true)
    })
})
