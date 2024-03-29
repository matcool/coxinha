import { ClientOptions, Client, Message, MessageEmbed, Intents, ApplicationCommandData, ApplicationCommand, Interaction } from 'discord.js';
import * as escapeRegExp from 'lodash.escaperegexp';
import * as has from 'lodash.has';
import { Command } from './command';
import { Argument } from './argument';
import { Context } from './context';
import { Check } from './checks';

interface BotCommands {
    [categoryName: string]: Command[]
}

interface BotCommandsPaths {
    [path: string]: Command[]
}

interface BotOptions extends ClientOptions {
    commandNotFound?: boolean; // disables whether to send 'Command not found'. default - false
    ownerId?: string; // id of the bot's owner, used in the isOwner check. default - null, which makes it get from fetchApplication (can fail if for example the bot is on a team)
    helpCommand?: boolean // toggles the default help command. default - true
    helpColor?: number // color to use in the default help command. default - #2bc0ce
    defaultCategoryName?: string; // name to use in the default category. default - 'default'
    mentionPrefix?: boolean; // whether to have mentioning the bot as a prefix. default - true
}

type SlashCommandFunction = (interaction: Interaction) => Promise<any>;

interface SlashCommmands {
    [name: string]: {
        command: ApplicationCommand,
        callback: SlashCommandFunction
    }
}

class Bot extends Client {
    prefix: string;
    commands: BotCommands;
    // This is used to store which file the command came from, which can be used for reloading
    commandsPaths: BotCommandsPaths;
    currentModule?: string;
    slashCommands: SlashCommmands;
    private owner?: string; // bot's owner id
    private commandNotFound: boolean;
    private defaultCategoryName: string;
    private mentionPrefix: boolean;
    private globalCheck?: Check;
    constructor(prefix: string, options?: BotOptions) {
        options = {
            intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES],
            ...(options ?? {})
        };
        super(options);
        this.prefix = prefix;
        this.commands = {};
        this.commandsPaths = {};
        this.currentModule = null;
        this.slashCommands = {};
        this.owner = options.ownerId;
        this.commandNotFound = options.commandNotFound ?? false;
        this.defaultCategoryName = options.defaultCategoryName ?? 'default';
        this.mentionPrefix = options.mentionPrefix ?? true;
        this.on('messageCreate', async message => {
            await this.processCommands(message);
        });
        if (options.helpCommand ?? true) {
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
                        let embed = new MessageEmbed({
                        title: `**${command.name}**`,
                        color,
                        description: command.help
                        })
                        .addField('Syntax', '`' + ctx.bot.prefix + command.syntax + '`', true);
                        if (command.aliases.length > 0) embed.addField('Aliases', command.aliases.map(name => '`'+name+'`').join(' '), true);
                        await ctx.send({embeds: [embed]});
                    } else {
                        let embed = new MessageEmbed({
                            title: '**Commands**',
                            color
                        });
                        for (let categoryName in ctx.bot.commands) {
                            embed.addField(categoryName, ctx.bot.commands[categoryName].filter(cmd => !cmd.hidden).map(cmd => '`' + cmd.name + '`').join(' '));
                        }
                        await ctx.send({embeds: [embed]});
                    }
                }
            }));
        }
        this.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;
            const command = this.slashCommands[interaction.commandName];
            if (command) {
                await command.callback(interaction);
            }
        });
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
    getCommand(command: string): Command | null {
        for (let cmd of this.walkCommands()) {
            if (cmd.match(command)) return cmd;
        }
        return null;
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
     * @param {Message} message
     */
    async processCommands(message: Message): Promise<void> {
        if (!message.content.startsWith(this.prefix) && !this.mentionPrefix) return;
        
        let mentions = this.mentionPrefix ? `|(?:<@${this.user.id}>|<@!${this.user.id}>) ?` : '';
        let pattern = new RegExp(`^(?:${escapeRegExp(this.prefix)}${mentions})(\\S+)(?: +)?((?:\\S+(?:(?: |\\n)+)?)+)?`);
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
        
        if (this.globalCheck) {
            if (!await this.globalCheck(ctx)) return;
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
            await this.application.fetch();
            this.owner = this.application.owner.id;
            return this.owner;
        }
    }
    setGlobalCheck(check?: Check) {
        this.globalCheck = check;
    }
    async addSlashCommand(data: ApplicationCommandData, callback: SlashCommandFunction) {
        const command = await this.application.commands.create(data);
        this.slashCommands[data.name] = {
            command,
            callback
        };
        return command;
    }
}

export { Bot };