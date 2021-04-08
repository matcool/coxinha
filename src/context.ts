import type { Message, User, TextChannel } from 'discord.js';
import { Bot } from './bot';
import { Command } from './command';

class Context {
    bot: Bot;
    message: Message;
    command: Command;
    author: User;
    public send: typeof TextChannel.prototype.send
    constructor(bot: Bot, message: Message, command: Command) {
        this.bot = bot;
        this.message = message;
        this.author = message.author;
        this.command = command;

        this.send = this.message.channel.send.bind(this.message.channel);
    }
}

export { Context };