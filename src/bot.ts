import * as Discord from 'discord.js';
import * as escapeRegExp from 'lodash.escaperegexp';
import * as has from 'lodash.has';
import { Command } from './command';
import { Argument } from './argument';
import { Context } from './context';

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
    private owner?: Discord.User;
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
        this.owner = null;
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
    async getOwner(): Promise<Discord.User> {
        if (this.owner) return this.owner;
        else {
            const app = await this.fetchApplication();
            this.owner = app.owner;
            return this.owner;
        }
    }
}

export { Bot };