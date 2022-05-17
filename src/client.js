const axios = require('axios');
const FormData = require('form-data');
const log = require('lambda-log');

class MutantWhatsClient {
    constructor(settings, messagesURL, transferURL, closeURL, conversationId) {
        // Token and cookie are for message sending only.
        this.token = settings.token;
        this.cookie = settings.cookie;

        this.messagesURL = messagesURL;
        this.transferURL = transferURL;
        this.closeURL = closeURL;

        this.conversationId = conversationId;

        this.debug = process.env.DEBUG === 'true'
    }

    async sendMessage(messageData) {
        const axiosConfig = {
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Cookie": `${this.cookie}`,
                "Content-Type": "application/json"
            },
            url: this.messagesURL,
            method: "post",
            data: messageData,
        }

        log.info("[MutantWhats Client] sendMessage", { axiosConfig });

        return this._sendRequest(axiosConfig)
    }

    async sendAttachment(messageData, filecontent, filename) {
        const url = this.messagesURL.replace('/activities', '/upload')

        const formData = new FormData()

        formData.append('activity', JSON.stringify(messageData));
        formData.append('file', filecontent, { filename });

        const axiosConfig = {
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Cookie": `${this.cookie}`,
                ...formData.getHeaders()
            },
            url: url,
            method: "post",
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        }

        log.info("[MutantWhats Client] sendAttachment", {
            axiosConfig,
            messageData
        })

        axiosConfig['data'] = formData

        return this._sendRequest(axiosConfig)
    }

    async sendTransferConversation(campaign_id) {
        const axiosConfig = {
            url: this.transferURL,
            method: 'put',
            data: { campaign_id },
            headers: {
                "Content-Type": "application/json"
            }
        }

        log.info("[MutantWhats Client]  sendTransferConversation", { axiosConfig })
        return this._sendRequest(axiosConfig)
    }

    async sendCloseConversation(status = 'solved', reasons = []) {
        const axiosConfig = {
            url: this.closeURL,
            method: 'put',
            data: { status, reasons },
            headers: {
                "Content-Type": "application/json"
            }
        }

        log.info("[MutantWhats Client] sendCloseConversation", { axiosConfig })
        return this._sendRequest(axiosConfig)
    }

    async _sendRequest(axiosConfig) {
        return axios(axiosConfig)
            .catch(err => {
                const response = err?.response;
                const data = response?.data;
                const msg = err?.message;
                const statusCode = response?.status;

                log.error('Axios request ERROR: ' + msg, { statusCode, data })
            })
    }
}

module.exports.MutantWhatsClient = MutantWhatsClient
