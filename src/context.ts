import * as Discord from 'discord.js';
import { Bot } from './bot';
import { Command } from './command';

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

export { Context };