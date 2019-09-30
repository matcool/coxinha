const Discord = require('discord.js');
const escapeRegExp = require('lodash.escaperegexp');

class Bot extends Discord.Client {
    constructor(prefix, options) {
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
            async func(ctx, command) {
                if (command) {
                    command = ctx.bot.getCommand(command);
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
    getCommand(command) {
        for (let cmd of this.commands) {
            if (cmd.match(command)) return cmd;
        }
    }
    addCommand(command) {
        if (this.getCommand(command.name))
            throw new Error('Command with same name already exists');
        this.commands.push(command);
    }
    async processCommands(message) {
        if (!message.content.startsWith(this.prefix)) return;

        let pattern = new RegExp(escapeRegExp(this.prefix) + '(\\S+) ?((?:\\S+? ?)+)?');
        let match = message.content.match(pattern);
        if (match === null) return;

        let command = match[1];
        let args = match[2];

        command = this.getCommand(command);

        let ctx = new Context(this, message, command);

        if (!command) {
            await ctx.send('Command not found');
            return;
        }

        command.run(ctx, args);
    }
}

class Context {
    constructor(bot, message, command) {
        this.bot = bot;
        this.message = message;
        this.author = message.author;
        this.command = command;
    }
    send(content, options) {
        return this.message.channel.send(content, options);
    }
}

class Command {
    constructor(options) {
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

        this.aliases = options.aliases || [];
    }
    async run(ctx, args) {
        args = args ? args.split(' ') : [];
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
            console.err(err);
        }
    }
    get syntax() {
        return `${this.name} ${this.args.map(arg => arg.syntax).join(' ')}`.trimRight();
    }
    /**
     * Returns whether the given name matches this command,
     * which means its either the command name or one of it's aliases
     * @param {string} name Name to match
     * @returns {boolean}
     */
    match(name) {
        return name == this.name || this.aliases.includes(name);
    }
}

class Argument {
    constructor(name, options) {
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
     * Returns a syntax thats used in the help command
     * <name> means its required
     * \[name] means its optional
     * name... means its combined
     * @returns {string}
     */
    get syntax() {
        let type = this.optional ? '[{}]' : '<{}>';
        let name = this.name + (this.combined ? '...' : '')
        return type.replace('{}', name);
    }
}

module.exports = { Bot, Command, Argument, Context };