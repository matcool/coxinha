interface ArgumentOptions {
    optional?: boolean;
    combined?: boolean;
}

class Argument {
    name: string;
    optional: boolean;
    combined: boolean;
    constructor(name: string, options: ArgumentOptions) {
        this.name = name;
        let defaults = {
            optional: false,
            combined: false
        }
        options = options ? { ...defaults, ...options } : defaults;
        this.optional = options.optional;
        this.combined = options.combined;
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