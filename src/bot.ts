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

interface BotOptions extends Discord.ClientOptions {
    commandNotFound?: boolean; // disables whether to send 'Command not found'. default - false
    ownerId?: string; // id of the bot's owner, used in the isOwner check. default - null, which makes it get from fetchApplication (can fail if for example the bot is on a team)
    helpCommand?: boolean // toggles the default help command. default - true
    helpColor?: number // color to use in the default help command. default - #2bc0ce
    defaultCategoryName?: string; // name to use in the default category. default - 'default'
}

class Bot extends Discord.Client {
    prefix: string;
    commands: BotCommands;
    // This is used to store which file the command came from, which can be used for reloading
    commandsPaths: BotCommandsPaths;
    currentModule?: string;
    private owner?: string; // bot's owner id
    private commandNotFound: boolean;
    private defaultCategoryName: string;
    constructor(prefix: string, options?: BotOptions) {
        options = options || {};
        super(options);
        this.prefix = prefix;
        this.commands = {};
        this.commandsPaths = {};
        this.currentModule = null;
        this.owner = options.ownerId;
        this.commandNotFound = options.commandNotFound || false;
        this.defaultCategoryName = options.defaultCategoryName || 'default';
        this.on('message', async message => {
            await this.processCommands(message);
        });
        // just doing (options.helpCommand || true) would make it always return true
        // as options.helpCommand can be either true, false or undefined
        if (options.helpCommand === undefined ? true : options.helpCommand) {
            this.addCommand(new Command({
                name: 'help',
                help: 'Lists all commands or shows help for given command',
                args: [
                    new Argument('command', {optional: true})
                ],
                async func(ctx: Context, commandName?: string) {
                    let color = options.helpColor || 0x2bc0ce;
                    if (commandName) {
                        let command = ctx.bot.getCommand(commandName);
                        if (!command) return await ctx.send('Command not found');
                        let embed = new Discord.RichEmbed({
                        title: `**${command.name}**`,
                        color,
                        description: command.help
                        })
                        .addField('Syntax', '`' + ctx.bot.prefix + command.syntax + '`', true);
                        if (command.aliases.length > 0) embed.addField('Aliases', command.aliases.map(name => '`'+name+'`').join(' '), true);
                        await ctx.send(embed);
                    } else {
                        let embed = new Discord.RichEmbed({
                            title: '**Commands**',
                            color
                        });
                        for (let categoryName in ctx.bot.commands) {
                            embed.addField(categoryName, ctx.bot.commands[categoryName].filter(cmd => !cmd.hidden).map(cmd => '`' + cmd.name + '`').join(' '));
                        }
                        await ctx.send(embed);
                    }
                }
            }));
        }
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

        const category = command.category || this.defaultCategoryName;

        if (!has(this.commands, category)) this.commands[category] = [];
        this.commands[category].push(command);

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
            if (this.commandNotFound) await ctx.send('Command not found');
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
    async getOwner(): Promise<string> {
        if (this.owner) return this.owner;
        else {
            const app = await this.fetchApplication();
            this.owner = app.owner.id;
            return this.owner;
        }
    }
}

export { Bot };