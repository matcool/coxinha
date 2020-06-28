import { Context } from './context';
import { Argument } from './argument';
import { Check } from './checks';

type CommandFunction = (ctx: Context, ...args: any[]) => any;

interface CommandOptions {
    name: string;
    aliases?: string[];
    func: CommandFunction;
    category?: string;
    args?: Argument[];
    help?: string;
    hidden?: boolean;
    checks?: Check[];
}

class Command {
    name: string;
    function: CommandFunction;
    args: Argument[];
    help?: string;
    hidden: boolean;
    aliases: string[];
    category: string;
    checks: Check[];
    // Private as they should only be used inside the command
    private required: number;
    private hasCombined: boolean
    constructor(options: CommandOptions) {
        let defaults = {
            args: [],
            help: null,
            hidden: false,
            category: null,
            aliases: [],
            checks: []
        }
        options = {...defaults, ...options};

        this.name = options.name;
        this.function = options.func;

        this.args = options.args;
        this.help = options.help;
        this.category = options.category;
        this.hidden = options.hidden;
        this.aliases = options.aliases;
        this.checks = options.checks;

        let hadOptional = false;
        this.required = 0;
        this.hasCombined = false;
        for (let i = 0; i < this.args.length; i++) {
            if (this.args[i].combined && i != this.args.length - 1)
                throw new Error('Combined argument should be last');

            if (this.args[i].combined)
                this.hasCombined = true;
            if (this.args[i].optional)
                hadOptional = true;
            else if (hadOptional)
                throw new Error('No regular argument after optional');
            else
                this.required++;
        }

    }
    /**
     * Run command in given context and raw arguments
     * @param {Context} ctx Context to run the command in
     * @param {string} [argStr] Raw arguments
     */
    async run(ctx: Context, argStr?: string): Promise<void> {
        for (let check of this.checks) {
            if (!await check(ctx)) return;
        }
        let args: string[] = argStr ? argStr.split(/ |\n/g) : [];
        if (args.length < this.required) {
            let missing = this.args[args.length];
            await ctx.send(`Argument ${missing.name} is missing.`);
            return;
        }
        if (this.hasCombined && args.length >= this.args.length) {
            if (this.args.length === 1) {
                args = [argStr];
            } else {
                args = [...args.slice(0, this.args.length - 1), argStr.substring(args.slice(0, this.args.length - 1).join(' ').length + 1)];
            }
        }

        let convertedArgs = [];

        for (let i = 0; i < args.length; i++) {
            let arg = args[i];
            let converter = this.args[i].converter
            convertedArgs.push(converter ? await converter(arg, ctx) : arg);
        }

        try {
            await this.function(ctx, ...convertedArgs);
        } catch (err) {
            console.log(err);
        }
    }
    /**
     * Syntax made of command's arguments
     * @type {string}
     * @readonly
     */
    get syntax(): string {
        return `${this.name} ${this.args.map(arg => arg.syntax).join(' ')}`.trimRight();
    }
    /**
     * Returns whether the given name matches this command,
     * which means its either the command name or one of it's aliases
     * @param {string} name Name to match
     * @returns {boolean}
     */
    match(name: string): boolean {
        return name == this.name || this.aliases.includes(name);
    }
}

export { Command };