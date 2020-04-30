import * as Discord from 'discord.js';
import { Context } from './context';

interface PaginatorOptions extends Discord.ReactionCollectorOptions {
    buttons?: 'simple' | 'all';
    startingPage?: number;
    deleteMessage?: boolean;
    clearReactions?: boolean;
    removeReaction?: boolean;
}

interface Button {
    name: string
    onClick: (parent: Paginator) => boolean | Promise<boolean>
}

class Paginator {
    getPage: (i: number) => Discord.MessageEmbed;
    pageCount: number;
    currentPage: number;
    private options: PaginatorOptions;
    private buttons: Button[];
    private message: Discord.Message;
    private check: (reaction: Discord.MessageReaction, user: Discord.User) => boolean;
    private collector: Discord.ReactionCollector;
    constructor(getPage: (i: number) => Discord.MessageEmbed, pageCount: number, options?: PaginatorOptions) {
        this.getPage = getPage;
        this.pageCount = pageCount;
        let defaultOptions: PaginatorOptions = {
            buttons: 'simple',
            startingPage: 0,
            deleteMessage: false,
            clearReactions: true,
            removeReaction: true
        };
        if (!options) {
            options = defaultOptions;
        } else {
            options = {...defaultOptions, ...options};
        }
        this.options = options;
        this.currentPage = options.startingPage; 
        this.buttons = [
            { name: '◀️', onClick(parent) {
                if (parent.currentPage === 0) return false;
                parent.currentPage--;
                return true;
            }},
            { name: '⏹️', async onClick(parent) {
                await parent.stop();
                return false;
            }},
            { name: '▶️', onClick(parent) {
                if (parent.currentPage === parent.pageCount - 1) return false;
                parent.currentPage++;
                return true;
            }},
        ];
        if (options.buttons === 'all') {
            this.buttons = [
                { name: '⏮️', onClick(parent) {
                    if (parent.currentPage === 0) return false;
                    parent.currentPage = 0;
                    return true;
                }},
                ...this.buttons,
                { name: '⏭️', onClick(parent) {
                    if (parent.currentPage === parent.pageCount - 1) return false;
                    parent.currentPage = parent.pageCount - 1;
                    return true;
                }}
            ]
        }
    }
    async start(ctx: Context) {
        this.message = await ctx.send(this.getPage(this.currentPage)) as Discord.Message;
        for (let button of this.buttons) {
            await this.message.react(button.name);
        }
        this.check = (reaction, user) => {
            return user.id == ctx.author.id && this.buttons.some(button => reaction.emoji.name === button.name);
        };
        this.collector = this.message.createReactionCollector(this.check, this.options);
        const listener = async (reaction: Discord.MessageReaction, user: Discord.User) => {
            if (user.id !== ctx.author.id) return;
            const button = this.buttons.find(button => button.name === reaction.emoji.name);
            if (await button.onClick(this)) {
                await this.message.edit(this.getPage(this.currentPage));
            }
            if (this.options.removeReaction) {
                try {
                    await reaction.users.remove(ctx.author);
                } catch (DiscordAPIError) {}
            }
        }
        this.collector.on('collect', listener);
        this.collector.on('end', async () => {
            await this.stop();
        })
    }
    async stop() {
        if (!this.collector.ended) {
            this.collector.stop();
            if (this.options.deleteMessage) {
                await this.message.delete();
            } else if (this.options.clearReactions) {
                try {
                    await this.message.reactions.removeAll();
                } catch (DiscordAPIError) {}
            }
        }
    }
}

export { Paginator };
