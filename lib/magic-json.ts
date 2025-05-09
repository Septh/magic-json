import fs from 'node:fs/promises'

interface Metadata {
    indent: string | undefined  // The guessed indentation string
    crlf: boolean               // Use CRLF rather than LF for line endings
    eof: boolean                // The text has a final EOL
    filepath?: string           // The name of the file the text was loaded from
}

export default abstract class MagicJSON {

    static readonly #meta = Symbol()

    /** Converts a JavaScript Object Notation (JSON) string into an object. */
    static parse(text: string, reviver?: (this: any, key: string, value: any) => any): any {

        // Parse first, in case it throws.
        const json = JSON.parse(text, reviver)

        // Detect indentation and line endings.
        const indents: Record<string, number> = Object.create(null)
        let lfCount = 0,
            crlfCount = 0,
            finalEol = false
        for (
            let pos = 0, end = text.length - 1,     // Loop limits
                eol: number,                        // Position of next \n in string
                line: string,                       // Current line
                previous = '',                      // Previous line's indent
                key = '';
            pos <= end;
            pos = eol + 1
        ) {

            // Get next line.
            eol = text.indexOf('\n', pos)
            if (eol >= 0) {
                if (text.charCodeAt(eol - 1) === 13) {
                    crlfCount++
                    line = text.slice(pos, eol - 1)
                }
                else {
                    lfCount++
                    line = text.slice(pos, eol)
                }
                if (eol === end)
                    finalEol = true
            }
            else {
                eol = end
                line = text.slice(pos)
            }

            // Ignore empty lines.
            if (!line) continue

            // Get the indent string and store its usage count.
            const indent = /^( +|\t+)/.exec(line)?.[1]
            if (indent) {
                if (indent === previous) {
                    // Same indentation, reuse key from previous iteration.
                    indents[key]++
                }
                else if (indent[0] === previous[0]) {
                    // Same indentation type, different length.
                    key = line.slice(0, Math.abs(indent.length - previous.length))
                    indents[key] = (indents[key] ?? 0) + 1
                }
                else {
                    // Different indentation.
                    key = indent
                    indents[key] = (indents[key] ?? 0) + 1
                }

                previous = indent
            }
            else previous = ''
        }

        // Find the most frequently used.
        let indent: string | undefined = undefined,
            max = 0
        for (const key in indents) {
            const count = indents[key]
            if (count > max) {
                indent = key
                max = count
            }
        }

        // Store the metadata.
        return Object.defineProperty(json, MagicJSON.#meta, {
            value: {
                indent,
                crlf: crlfCount > lfCount,
                eof: finalEol
            } satisfies Metadata
        })
    }

    /** Converts a JavaScript value to a JavaScript Object Notation (JSON) string. */
    static stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {

        // Get the metadata, if present.
        const { indent, crlf, eof } = (
            typeof value === 'object' && value !== null
                ? value[MagicJSON.#meta] as Metadata | undefined
                : undefined
        ) ?? { indent: undefined, crlf: false, eof: false } satisfies Metadata

        // Stringify, update and return the text.
        let text = JSON.stringify(value, replacer, space ?? indent)
        if (eof) text += '\n'
        if (crlf) text = text.replaceAll('\n', '\r\n')
        return text
    }

    /** Reads and converts a JSON file into an object. */
    static async fromFile(filepath: string): Promise<any> {
        const text = await fs.readFile(filepath, 'utf-8')
        const json = MagicJSON.parse(text)
        const meta = json[this.#meta] as Metadata
        meta.filepath = filepath
        return json
    }

    /** Rewrites a JavaScript value to the JSON file it was loaded from. */
    static async write(value: any, filepath?: string): Promise<void> {
        if (typeof value === 'object' && value !== null) {
            const meta = value[this.#meta] as Metadata | undefined
            filepath ??= meta?.filepath
        }

        if (typeof filepath !== 'string')
            throw new TypeError('Filepath missing')

        await fs.writeFile(filepath, MagicJSON.stringify(value))
    }

    // Disallow instantiating the class.
    /** @internal */constructor(...args: any[]) {
        throw new TypeError(`Cannont instantiate ${MagicJSON.name}`)
    }
}
