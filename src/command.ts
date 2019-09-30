import * as Discord from 'discord.js';
import * as escapeRegExp from 'lodash.escaperegexp';

class Bot extends Discord.Client {
    prefix: string;
    commands: Command[];
    constructor(prefix: string, options: Discord.ClientOptions) {
        super(options);
        this.prefix = prefix;
        this.commands = []
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
                       color: 0x3498db,
                       description: command.help
                    })
                    .addField('Syntax', '`' + ctx.bot.prefix + command.syntax + '`');
                    await ctx.send(embed);
                } else {
                    let embed = new Discord.RichEmbed({
                        title: '**Commands**',
                        color: 0x3498db,
                        description: ctx.bot.commands.filter(cmd => !cmd.hidden).map(cmd => '`' + cmd.name + '`').join(' ')
                    });
                    await ctx.send(embed);
                }
            }
        }));
    }
    /**
     * Get command by name (will also looks through aliases)
     * @param {string} command Command name to search for
     * @returns {Command}
     */
    getCommand(command: string): Command {
        for (let cmd of this.commands) {
            if (cmd.match(command)) return cmd;
        }
    }
    /**
     * Adds command to internal command list
     * @param {Command} command 
     */
    addCommand(command: Command) {
        if (this.getCommand(command.name))
            throw new Error('Command with same name already exists');
        this.commands.push(command);
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