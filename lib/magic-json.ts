import fs from 'node:fs/promises'

interface Metadata {
    indent: string | undefined  // The guessed indentation string
    crlf: boolean               // Use CRLF rather than LF for line endings
    eof: boolean                // The text has a final EOL
    filepath?: string           // The name of the file the text was loaded from
}

export default abstract class MagicJSON {

    static readonly #meta = Symbol()

    // Gets the Metadata associated with the object, if it exists.
    static #getMetadata(value: any): Metadata | undefined {
        return typeof value === 'object' ? value?.[this.#meta] : undefined
    }

    // Adds a hidden (non-enumerable, non-writable, non-configurable) Metadata property to the object.
    static #setMetadata(value: any, meta: Metadata): any {
        return Object.defineProperty(value, this.#meta, { value: meta })
    }

    /**
     * Checks if `value` is a MagicJSON object.
     */
    static isManaged(value: any): boolean {
        return !!this.#getMetadata(value)
    }

    /**
     * Converts a JavaScript Object Notation (JSON) string into an object.
     */
    static parse(text: string, reviver?: (this: any, key: string, value: any) => any): any {

        // Parse first, in case it throws or the result is not an object.
        const json = JSON.parse(text, reviver)
        if (typeof json !== 'object' || json === null)
            return json

        // Detect indentation and line endings.
        const indents: Record<string, number> = Object.create(null)
        let lfCount = 0,
            crlfCount = 0,
            hasFinalEol = false
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
                    hasFinalEol = true
            }
            else {
                eol = end
                line = text.slice(pos)
            }

            // Get the indent string and store its usage count.
            if (line.length) {
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
        }

        // Find the most frequently used.
        let indent: string | undefined = undefined,
            max = 0
        for (const key in indents) {
            const used = indents[key]
            if (used > max) {
                max = used
                indent = key
            }
        }

        // Store the metadata.
        return this.#setMetadata(json, { indent, crlf: crlfCount > lfCount, eof: hasFinalEol })
    }

    /**
     * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
     *
     * Works as `JSON.stringify()` if `value` is not a MagicJSON object.
     *
     * If `value` *is* a MagicJSON object and `space` is given, it overrides the detected indentation.
     */
    static stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {

        // Get the metadata, if present.
        const { indent, crlf, eof } = this.#getMetadata(value) ?? { indent: undefined, crlf: false, eof: false } satisfies Metadata

        // Stringify, update and return the text.
        let text = JSON.stringify(value, replacer, space ?? indent)
        if (eof) text += '\n'
        if (crlf) text = text.replaceAll('\n', '\r\n')
        return text
    }

    /**
     * Reads and converts a JSON file into an object.
     */
    static async fromFile(filepath: string): Promise<any> {
        const text = await fs.readFile(filepath, 'utf-8')
        const json = this.parse(text)
        const meta = this.#getMetadata(json)
        if (meta)
            meta.filepath = filepath
        return json
    }

    /**
     * Rewrites a JavaScript value back to the JSON file it was loaded from.
     *
     * If `filepath` is given, it overrides the path associated with the object.
     *
     * `filepath` is mandatory if either `value` is not a MagicJSON object or it wasn't
     * loaded with `.fromFile()`.
     */
    static async write(value: any, filepath?: string): Promise<void> {
        filepath ??= this.#getMetadata(value)?.filepath
        if (typeof filepath !== 'string')
            throw new TypeError(`value is not a ${MagicJSON.name} object and no filepath was given`)
        await fs.writeFile(filepath, this.stringify(value))
    }

    // Disallow instantiating the class.
    /** @internal */constructor(...args: any[]) {
        throw new TypeError(`Cannont instantiate ${MagicJSON.name}`)
    }
}
