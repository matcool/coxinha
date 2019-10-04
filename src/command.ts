import * as Discord from 'discord.js';
import * as escapeRegExp from 'lodash.escaperegexp';
import * as has from 'lodash.has';

interface BotCommands {
    [categoryName: string]: Command[]
}

interface BotCommandsPaths {
    [path: string]: Command[]
}

class Bot extends Discord.Client {
    prefix: string;
    commands: BotCommands;
    // This is used to store which file the command came from, which can be used for reloading
    commandsPaths: BotCommandsPaths;
    currentModule?: string;
    constructor(prefix: string, options: Discord.ClientOptions) {
        super(options);
        this.prefix = prefix;
        this.commands = {};
        this.commandsPaths = {};
        this.currentModule = null;
        this.on('message', async message => {
            await this.processCommands(message);
        });
        this.addCommand(new Command({
            name: 'help',
            help: 'Lists all commands or shows help for given command',
            args: [
                new Argument('command', {optional: true})
            ],
            async func(ctx: Context, commandName?: string) {
                if (commandName) {
                    let command = ctx.bot.getCommand(commandName);
                    if (!command) return await ctx.send('Command not found');
                    let embed = new Discord.RichEmbed({
                       title: `**${command.name}**`,
                       color: 0x2bc0ce,
                       description: command.help
                    })
                    .addField('Syntax', '`' + ctx.bot.prefix + command.syntax + '`', true);
                    if (command.aliases.length > 0) embed.addField('Aliases', command.aliases.map(name => '`'+name+'`').join(' '), true);
                    await ctx.send(embed);
                } else {
                    let embed = new Discord.RichEmbed({
                        title: '**Commands**',
                        color: 0x2bc0ce
                    });
                    for (let categoryName in ctx.bot.commands) {
                        embed.addField(categoryName, ctx.bot.commands[categoryName].filter(cmd => !cmd.hidden).map(cmd => '`' + cmd.name + '`').join(' '));
                    }
                    await ctx.send(embed);
                }
            }
        }));
    }
    * walkCommands(): IterableIterator<Command> {
        for (let categoryCmds of Object.values(this.commands)) {
            for (let command of categoryCmds) {
                yield command;
            }
        }
    }
    /**
     * Get command by name (will also looks through aliases)
     * @param {string} command Command name to search for
     * @returns {Command}
     */
    getCommand(command: string): Command {
        for (let cmd of this.walkCommands()) {
            if (cmd.match(command)) return cmd;
        }
    }
    /**
     * Adds command to internal command list
     * @param {Command} command 
     */
    addCommand(command: Command, file?: string) {
        file = file || this.currentModule;
        if (this.getCommand(command.name))
            throw new Error('Command with same name already exists');

        if (!has(this.commands, command.category)) this.commands[command.category] = [];
        this.commands[command.category].push(command);

        if (file) {
            if (!has(this.commandsPaths, file)) this.commandsPaths[file] = [];
            this.commandsPaths[file].push(command);
        }
    }
    /** 
     * Looks for and executes command in given message
     * @param {Discord.Message} message
     */
    async processCommands(message: Discord.Message): Promise<void> {
        if (!message.content.startsWith(this.prefix)) return;

        let pattern = new RegExp(escapeRegExp(this.prefix) + '(\\S+) ?((?:\\S+? ?)+)?');
        let match = message.content.match(pattern);
        if (match === null) return;

        let commandName = match[1];
        let args = match[2];

        let command = this.getCommand(commandName);

        let ctx = new Context(this, message, command);

        if (!command) {
            await ctx.send('Command not found');
            return;
        }

        command.run(ctx, args);
    }
    loadModule(modulePath: string) {
        modulePath = require.resolve(modulePath);
        delete require.cache[modulePath];
        this.currentModule = modulePath;
        require(modulePath)(this);
        this.currentModule = null;
    }
    unloadModule(modulePath: string) {
        modulePath = require.resolve(modulePath);
        // Ignore if not loaded
        if (!has(this.commandsPaths, modulePath)) return;
        // Manual loop since the index is required
        for (let category of Object.keys(this.commands)) {
            for (let i = 0; i < this.commands[category].length; i++) {
                for (let command of this.commandsPaths[modulePath]) {
                    // This should be equal when same as they refer to the same object
                    // So no need for .match()
                    if (this.commands[category][i] === command) {
                        this.commands[category].splice(i, 1);
                        i--;
                    }
                }
            }
        }
        delete this.commandsPaths[modulePath];
    }
}

class Context {
    bot: Bot;
    message: Discord.Message;
    command: Command;
    author: Discord.User;
    constructor(bot: Bot, message: Discord.Message, command: Command) {
        this.bot = bot;
        this.message = message;
        this.author = message.author;
        this.command = command;
    }
    /**
     * Shorthand for message.channel.send
     * @param content Text for the message
     * @param options Options for the message, can also be just a RichEmbed or Attachment
     */
    send(content?: Discord.StringResolvable, options?: Discord.MessageOptions | Discord.Attachment | Discord.RichEmbed): Promise<(Discord.Message|Array<Discord.Message>)> {
        return this.message.channel.send(content, options);
    }
}

type CommandFunction = (ctx: Context, ...args: any[]) => any;

interface CommandOptions {
    name: string;
    aliases?: string[];
    func: CommandFunction;
    category?: string;
    args?: Argument[];
    help?: string;
    hidden?: boolean;
}

class Command {
    name: string;
    function: CommandFunction;
    args: Argument[];
    help: string;
    hidden: boolean;
    aliases: string[];
    category: string;
    // Private as they should only be used inside the command
    private required: number;
    private hasCombined: boolean
    constructor(options: CommandOptions) {
        let defaults = {
            args: [],
            help: null,
            hidden: false
        }
        options = {...defaults, ...options};

        this.name = options.name;
        this.function = options.func;

        this.args = options.args;
        this.help = options.help;
        this.category = options.category || 'default';
        this.hidden = options.hidden;
        this.aliases = options.aliases || [];

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
        let args: string[] = argStr ? argStr.split(' ') : [];
        if (args.length < this.required) {
            let missing = this.args[args.length];
            await ctx.send(`Argument ${missing.name} is missing.`);
            return;
        }
        if (this.hasCombined && args.length >= this.args.length) {
            args = [...args.slice(0, this.args.length - 1), args.slice(this.args.length - 1).join(' ')];
        }
        try {
            await this.function(ctx, ...args);
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
export { Bot, Command, Argument, Context };