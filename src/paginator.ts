import { CollectorFilter, InteractionCollector, InteractionCollectorOptions, Message, MessageActionRow, MessageButton, MessageComponentInteraction, MessageEmbed } from 'discord.js';
import { Context } from './context';
import { nanoid } from 'nanoid';

interface PaginatorOptions extends InteractionCollectorOptions<MessageComponentInteraction> {
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
    private check: CollectorFilter<MessageComponentInteraction[]>;
    private collector: InteractionCollector<MessageComponentInteraction>;
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
            let msgButton = new MessageButton().setLabel(button.name).setCustomId(nanoid()).setStyle('PRIMARY');
            button.id = msgButton.customId;
            row.addComponents(msgButton);
        }
        this.message = await ctx.send({ embeds: [await this.getPage(this.currentPage)], components: [row] });
        this.check = (button: MessageComponentInteraction) => {
            return button.isButton() && button.user.id === ctx.author.id;
        };
        this.collector = this.message.createMessageComponentCollector({
            filter: this.check,
            ...this.options
        });
        const listener = async (msgButton: MessageComponentInteraction) => {
            const button = this.buttons.find(button => button.id === msgButton.customId);
            if (await button.onClick(this)) {
                await this.message.edit({ embeds: [await this.getPage(this.currentPage)], components: [row] });
            }
            await msgButton.deferUpdate();
        }
        this.collector.on('collect', listener);
        this.collector.on('end', async (_, reason) => {
            if (reason === 'idle')
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
                    await this.message.edit({ content: '_ _', embeds: [], components: [] });
                } else {
                    await this.message.edit({ embeds: this.message.embeds, components: [] });
                }
            }
        }
    }
    addButton(button: Button) {
        this.buttons.push(button);
    }
}

export { Paginator };
