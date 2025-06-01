import { readFile, writeFile } from 'node:fs/promises'
import { deprecate } from 'node:util'

/** @internal */
export interface Metadata {
    indentString: string | undefined    // The guessed indentation string
    useCRLF: boolean                    // The text uses CRLF rather than LF for line endings
    hasFinalEol: boolean                // The text has a final EOL
    filepath?: string                   // The path to the file the text was loaded from
}

export default abstract class MagicJSON {

    static readonly #refsMap = new WeakMap<any, Metadata>()

    /** @internal Gets the Metadata associated with the object, if it exists. */
    static getMetadata(value: any): Readonly<Metadata> | undefined {
        const meta = this.#refsMap.get(value)
        return meta && Object.freeze(meta)
    }

    /**
     * Checks if `value` is a MagicJSON object.
     */
    static isMagic(value: any): boolean {
        return this.#refsMap.has(value)
    }

    /** @deprecated Use MagicJSON.isMagic() instead. */
    static isManaged = deprecate((value: any) => this.isMagic(value), 'MagicJSON.isManaged() is deprecated, please use MagicJSON.isMagic() instead.')

    /**
     * Reads and converts a JSON file into an object.
     */
    static async fromFile(filepath: string): Promise<any> {
        const text = await readFile(filepath).then(buffer => buffer.toString())
        const json = this.parse(text)
        const meta = this.#refsMap.get(json)
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
        filepath ??= this.#refsMap.get(value)?.filepath
        if (typeof filepath !== 'string')
            throw new TypeError(`value is not a ${MagicJSON.name} object and filepath argument was not given`)
        await writeFile(filepath, this.stringify(value))
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
        const indents: Record<string, number> = {}
        let lfCount = 0,
            crCount = 0,
            hasFinalEol = false
        for (
            let pos = 0, end = text.length - 1,     // Loop limits
                nextEol: number,                    // Position of next \n in string
                line: string,                       // Current line
                previousIndent = '',                // Previous line indent
                key = '';
            pos <= end;
            pos = nextEol + 1
        ) {

            // Get next line.
            nextEol = text.indexOf('\n', pos)
            if (nextEol >= 0) {
                if (text.charCodeAt(nextEol - 1) === 13) {
                    crCount++
                    line = text.slice(pos, nextEol - 1)
                }
                else {
                    lfCount++
                    line = text.slice(pos, nextEol)
                }
                if (nextEol === end)
                    hasFinalEol = true
            }
            else {
                nextEol = end
                line = text.slice(pos)
            }

            // Get the indent string and store its usage count.
            if (line.length) {
                const lineIndent = /^( +|\t+)/.exec(line)?.[1]
                if (lineIndent) {
                    if (lineIndent === previousIndent) {
                        // Same indentation, increment use count (reusing key from previous iteration).
                        indents[key]++
                    }
                    else if (lineIndent[0] === previousIndent[0]) {
                        // Same indentation type, different length.
                        key = line.slice(0, Math.abs(lineIndent.length - previousIndent.length))
                        indents[key] = (indents[key] ?? 0) + 1
                    }
                    else {
                        // Different indentation.
                        key = lineIndent
                        indents[key] = (indents[key] ?? 0) + 1
                    }
                    previousIndent = lineIndent
                }
                else previousIndent = ''
            }
        }

        // Find the most frequently used.
        let indentString: string | undefined = undefined,
            max = 0
        for (const key in indents) {
            const used = indents[key]
            if (used > max) {
                max = used
                indentString = key
            }
        }

        // Store the metadata.
        this.#refsMap.set(json, { indentString, useCRLF: crCount > lfCount, hasFinalEol })
        return json
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
        const { indentString, useCRLF, hasFinalEol } = this.#refsMap.get(value) ?? { indentString: undefined, useCRLF: false, hasFinalEol: false } satisfies Metadata

        // Stringify, update and return the text.
        let text = JSON.stringify(value, replacer, space ?? indentString)
        if (hasFinalEol)
            text += '\n'
        if (useCRLF)
            text = text.replaceAll('\n', '\r\n')
        return text
    }

    // Disallow instantiating the class.
    /** @internal */constructor(...args: any[]) {
        throw new TypeError(`Can't instantiate ${MagicJSON.name}`)
    }
}
