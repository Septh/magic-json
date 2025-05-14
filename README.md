# MagicJSON
> Parse and stringify JSON strings and files, preserving indentation and line endings.

You can use this library as a drop-in replacement for the JavaScript [JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) API.

```ts
import MagicJSON from 'magic-json'

const json = getJsonSomehow()

const data = MagicJSON.parse(json)
const revived = MagicJSON.stringify(data)
```

* `.parse()` will attach an additional non-enumerable, non-writable, non-configurable, property to the returned object that contains metadata about the text's indentation (space or tab, width) and line endings (LF or CRLF).
* `.stringify()` will use this metadata to recreate a string that is as close as possible to the original.

The primary use case is to load/edit/save JSON files like `package.json` in a lossless-ish way.

## API

#### `parse(text: string, reviver?: (this: any, key: string, value: any) => any): any`
This API has the same signature as `JSON.parse()`, which it calls under the hood. Once parsed, the source text is analyzed to determine the indentation and line endings. This information is then stored in a hidden property on the returned object.

#### `stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string`
This API has the same signature as `JSON.stringify()`, which it calls under the hood. It uses the information stored in the hidden property to revive the text with the same indentation (unless the `space` parameter is given) and line endings.

#### `async fromFile(filepath: string): Promise<any>`
Reads JSON from a file and calls `parse()`.

#### `async write(value: any, filepath?: string): Promise<void>`
Calls `stringify()` and writes the result to the same file the JSON text was loaded from, unless a different `filepath` is given.

```ts
import MagicJSON from 'magic-json'

const pkg = MagicJSON.fromFile('./package.json')
/* edit the object at will, then: */
MagicJSON.write(pkg)
```

## License
MIT
