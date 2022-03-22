import fetch from "#core/fetch";
import { sleep } from "#core/utils";

const DEFAULT_TIMEOUT = 3000;

export default class Anticaptcha {
    #apiToken;

    constructor ( apiToken ) {
        this.#apiToken = apiToken;
    }

    // public
    async getBalance () {
        const res = await this.#request( "post", "getBalance" );

        if ( res.ok ) res.data = res.data.balance;

        return res;
    }

    async recaptchaV2TaskProxyless ( websiteUrl, websiteKey ) {
        const res = await this.#request( "post", "createTask", {
            "task": {
                "type": "RecaptchaV2TaskProxyless",
                "websiteURL": websiteUrl,
                websiteKey,
            },
        } );

        if ( !res.ok ) return res;

        return this.#getTaskResult( res.data.taskId );
    }

    // private
    async #request ( method, path, body = {} ) {
        body.clientKey = this.#apiToken;

        const res = await fetch( "https://api.anti-captcha.com/" + path, {
            method,
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( body ),
        } );

        if ( !res.ok ) return res;

        try {
            const data = await res.json();

            if ( data.errorDescription ) return result( [500, data.errorDescription] );

            return result( 200, data );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #getTaskResult ( taskId ) {
        while ( 1 ) {
            await sleep( DEFAULT_TIMEOUT );

            const res = await this.#request( "post", "getTaskResult", { taskId } );

            if ( !res.ok ) return res;

            if ( res.data.status === "ready" ) {
                res.data.id = taskId;

                return res;
            }
        }
    }
}
