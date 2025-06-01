# MagicJSON
> Parse then re-stringify JSON strings and files, preserving indentation and line endings.

The primary use case is to load/edit/save JSON files like `package.json` in a lossless-ish way.


## Usage

```ts
import MagicJSON from 'magic-json'

// Read and parse some JSON object from a file:
const pkg = await MagicJSON.fromFile('./package.json')

// Edit the object at will:
pkg.version = '2.0.0'
delete pkg.private

// Then write it back to the same file, with the same indentation and line endings:
await MagicJSON.write(pkg)
```


## API

MagicJSON can be used as a drop-in replacement for the JavaScript [JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) API.


**`MagicJSON.parse(text: string, reviver?: (this: any, key: string, value: any) => any): any`**
- This API has the same signature as `JSON.parse()`, which it calls under the hood. Once parsed, the source text is analyzed to determine the indentation and line endings. This information is then stored in an internal WeakMap.

**`MagicJSON.stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string`**
- This API has the same signature as `JSON.stringify()`, which it calls under the hood. It uses the information stored par `.parse()` to revive the text with the same indentation (unless the `space` parameter is given) and line endings.

> Notes
> - `MagicJSON.stringify()` works the same as `JSON.stringify()` if `value` is not a MagicJSON object.
> - If `value` *is* a MagicJSON object and `space` is given, it overrides the detected indentation.

**`async MagicJSON.fromFile(filepath: string): Promise<any>`**
- Reads some JSON text from a file and calls `.parse()` on it.

**`async MagicJSON.write(value: any, filepath?: string): Promise<void>`**
- Calls `.stringify()` and writes the result back to the same file the JSON text was loaded from, unless a different `filepath` is given.

> Notes
> - If `filepath` is given, it overrides the path associated with the object.
> - `filepath` is mandatory if either `value` is not a MagicJSON object or it wasn't loaded with `.fromFile()`.

**`MagicJSON.isMagic(value: any): boolean`**
- Returns `true` if `value` is a MagicJSON object, `false` otherwise.

**`MagicJSON.isManaged(value: any): boolean`**
- Deprecated. Use `MagicJSON.isMagic(value)` instead.


## License
MIT
