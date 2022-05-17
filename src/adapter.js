const { TurnContext, StatusCodes } = require('botbuilder');
const { CustomWebAdapter } = require('@botbuildercommunity/core');

const { MutantWhatsClient } = require('./client');

class MutantWhatsAdapter extends CustomWebAdapter {
    constructor(botData) {
        super();

        botData.role = 'bot';
        this.botData = botData;

        this.debug = process.env.DEBUG === 'true';
    }

    async processActivity(req, res, action, logic) {
        const message = await this.retrieveBody(req);

        if (!message) {
            res.status(400);
            res.end();
            return;
        }

        const conversationId = message.conversationId ? message.conversationId : message.conversation_id;
        const ticketId = message.ticket_id;

        const now = new Date();

        const activity = {
            id: ticketId,
            timestamp: now.toUTCString(),
            localTimestamp: now.toISOString(),
            channelId: 'whatsapp',
            conversation: {
                id: conversationId,
                isGroup: false,
                conversationType: null,
                tenantId: null,
                name: ""
            },
            recipient: this.botData,
            localTimezone: 'America/Sao_Paulo',
            callerId: null,
            serviceUrl: null,
            listenFor: null,
            label: conversationId,
            valueType: null,
            type: 'message'
        };

        if (action === "message") {
            const activityRequest = message.activities[0];

            activity.text = activityRequest.text;
            activity.attachments = activityRequest.attachments;
            activity.channelData = {
                conversationId,
                actionType: action
            };
            activity.from = activityRequest.from;
        }

        if (action === "start-conversation") {
            activity.from = {
                id: message.contact.identifier,
                name: message.contact.name,
                role: 'user'
            }
            activity.text = message.start_message;
            activity.channelData = {
                ...message,
                conversationId,
                actionType: action,
            };
        }

        const context = this.createContext(activity);

        context.turnState.set("httpStatus", StatusCodes.OK);
        await this.runMiddleware(context, logic);

        res.status(context.turnState.get("httpStatus"));
        if (context.turnState.get("httpBody")) {
            res.send(context.turnState.get("httpBody"));
        } else {
            res.end();
        }
    }

    async sendActivities(context, activities) {
        const responses = [];

        const { token, cookie, messageUrl, transferTo, closeUrl, conversationId } = context.activity.channelData;

        const mutantWhatsClient = new MutantWhatsClient(
            { token, cookie },
            messageUrl, transferTo, closeUrl, conversationId
        )

        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < activities.length; i++) {
            const activity = activities[i];

            switch (activity.type) {
                case "delay":
                    await this.delay(activity.value);
                    responses.push({});
                    break;
                case 'message':
                    const message = this.parseActivity(activity);
                    await mutantWhatsClient.sendMessage(message);

                    responses.push({});
                    break;
                case 'Handoff':
                    const codeHandoff = activity.code;
                    await mutantWhatsClient.sendTransferConversation(codeHandoff);

                    responses.push({});
                    break;
                case 'EndOfConversation':
                    const codeEndConversation = activity.code || 'solved';
                    await mutantWhatsClient.sendCloseConversation(codeEndConversation)

                    responses.push({});
                    break;
                case 'attachment':
                    const { file: filecontent, filename } = activity.attachments[0]

                    const messageWithAttachment = this.parseActivity(activity)
                    await mutantWhatsClient.sendAttachment(messageWithAttachment, filecontent, filename)

                    break;

                default:
                    responses.push({});
                    console.warn(`MutantWhatsAdapter.sendActivities(): Activities of type '${activity.type}' aren't supported.`);
            }
        }

        return responses;
    }

    parseActivity(activity) {
        // Change formatting to WhatsApp formatting
        if (activity.text) {
            activity.text = activity.text.replace(/<b>(.*?)<\/b>/gis, "*$1*");
            activity.text = activity.text.replace(/<i>(.*?)<\/i>/gis, "_$1_");
            activity.text = activity.text.replace(/<s>(.*?)<\/s>/gis, "~$1~");
            activity.text = activity.text.replace(/<code>(.*?)<\/code>/gis, "```$1```");
        }

        const now = new Date()

        return {
            "channelData": {
                "clientActivityID": "161529868025941mn7p4d2qe",
                "clientTimestamp": now.toISOString()
            },
            "text": activity.text,
            "textFormat": 'plain',
            "type": 'message',
            "channelId": "webchat",
            "from": this.botData,
            "timestamp": now.toISOString()
        };
    }

    createContext(request) {
        return new TurnContext(this, request);
    }
}

module.exports.MutantWhatsAdapter = MutantWhatsAdapter;