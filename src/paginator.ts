import { CollectorFilter, Message, MessageEmbed, MessageOptions } from 'discord.js';
import { Context } from './context';
import { AwaitMessageButtonOptions, ButtonCollector, ExtendedMessage, MessageActionRow, MessageButton, MessageComponent } from 'discord-buttons';
import { nanoid } from 'nanoid';

interface PaginatorOptions extends AwaitMessageButtonOptions {
    buttons?: 'simple' | 'all';
    startingPage?: number;
    deleteMessage?: boolean;
    removeEmbed?: boolean;
}

interface Button {
    name: string
    onClick: (parent: Paginator) => boolean | Promise<boolean>
    id?: string
}

class Paginator {
    getPage: (i: number) => MessageEmbed;
    pageCount: number;
    currentPage: number;
    private options: PaginatorOptions;
    private buttons: Button[];
    private message: Message;
    private check: CollectorFilter;
    private collector: ButtonCollector;
    constructor(getPage: (i: number) => MessageEmbed, pageCount: number, options?: PaginatorOptions) {
        this.getPage = getPage;
        this.pageCount = pageCount;
        let defaultOptions: PaginatorOptions = {
            buttons: 'simple',
            startingPage: 0,
            deleteMessage: true,
            removeEmbed: false,
        };
        if (!options) {
            options = defaultOptions;
        } else {
            options = {...defaultOptions, ...options};
        }
        this.options = options;
        this.currentPage = options.startingPage; 
        this.buttons = [
            { name: '❮', onClick(parent) {
                if (parent.currentPage === 0) return false;
                parent.currentPage--;
                return true;
            }},
            { name: '⯀', async onClick(parent) {
                await parent.stop();
                return false;
            }},
            { name: '❯', onClick(parent) {
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
        let row = new MessageActionRow();
        for (let button of this.buttons) {
            let mbutton = new MessageButton().setLabel(button.name).setID(nanoid()).setStyle('blurple' as any);
            button.id = mbutton.custom_id;
            row.addComponent(mbutton);
        }
        this.message = await ctx.send({ embed: await this.getPage(this.currentPage), component: row } as MessageOptions) as Message;
        this.check = (button: MessageComponent) => {
            return button.clicker.user.id == ctx.author.id;
        };
        this.collector = (this.message as ExtendedMessage).createButtonCollector(this.check, this.options);
        const listener = async (mbutton: MessageComponent) => {
            if (mbutton.clicker.user.id !== ctx.author.id) return;
            const button = this.buttons.find(button => button.id === mbutton.id);
            if (await button.onClick(this)) {
                await this.message.edit({ embed: await this.getPage(this.currentPage), component: row } as MessageOptions);
            }
            mbutton.defer();
        }
        this.collector.on('collect', listener);
        this.collector.on('end', async () => {
            await this.stop(true);
        })
    }
    async stop(idle: boolean = false) {
        if (!this.collector.ended || idle) {
            if (!idle) this.collector.stop();
            if (!idle && this.options.deleteMessage) {
                await this.message.delete();
            } else {
                if (!idle && this.options.removeEmbed) {
                    // send '_ _' instead of nothing since discord really hates empty messages
                    await this.message.edit('_ _', {embed: null, component: null} as MessageOptions);
                } else {
                    await this.message.edit({embed: this.message.embeds[0], component: null} as MessageOptions);
                }
            }
        }
    }
    addButton(button: Button) {
        this.buttons.push(button);
    }
}

export { Paginator };
