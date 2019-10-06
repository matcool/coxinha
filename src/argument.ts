import { Converter } from './converters';

interface ArgumentOptions {
    optional?: boolean;
    combined?: boolean;
    converter?: Converter;
}

class Argument {
    name: string;
    optional: boolean;
    combined: boolean;
    converter?: Converter;
    constructor(name: string, options: ArgumentOptions) {
        this.name = name;
        let defaults = {
            optional: false,
            combined: false,
            converter: null
        }
        options = options ? { ...defaults, ...options } : defaults;
        this.optional = options.optional;
        this.combined = options.combined;
        this.converter = options.converter;
    }
    /**
     * Syntax thats used in the help command \
     * <name> means its required \
     * \[name] means its optional \
     * name... means its combined
     * @type {string}
     * @readonly
     */
    get syntax(): string {
        let type = this.optional ? '[{}]' : '<{}>';
        let name = this.name + (this.combined ? '...' : '')
        return type.replace('{}', name);
    }
}
export { Argument };