import { CaptchaApi, Captcha } from "#lib/captcha";
import fetch from "#core/fetch";
import { sleep } from "#core/utils";

const DEFAULT_TIMEOUT = 3000;

const RECAPTCHA_TYPES = new Set( ["recaptchaV2TaskProxyless"] );

const IMAGE_CAPTCHA_TYPE = {
    "numbers": 1, // only numbers are allowed
    "letters": 2, // any letters are allowed except numbers
};

export default class Anticaptcha extends CaptchaApi {
    #apiToken;

    constructor ( apiToken, options ) {
        super( options );

        this.#apiToken = apiToken;
    }

    // public
    async getBalance () {
        const res = await this.#request( "post", "getBalance" );

        if ( res.ok ) res.data = res.data.balance;

        return res;
    }

    async resolveImageCaptcha ( image, { phrase, caseSensitive, numeric, calc, minLength, maxLength, comment, websiteUrl } = {} ) {
        if ( numeric && !IMAGE_CAPTCHA_TYPE[numeric] ) throw `Numeric value is invalid`;

        var res = await this.#request( "post", "createTask", {
            "task": {
                "type": "ImageToTextTask",
                "body": image.toString( "base64" ),
                phrase,
                "case": caseSensitive,
                "numeric": numeric ? IMAGE_CAPTCHA_TYPE[numeric] : 0,
                "math": calc,
                minLength,
                maxLength,
                comment,
                "websiteURL": websiteUrl,
            },
        } );

        if ( !res.ok ) return res;

        return this.#getTaskResult( res.data.taskId, "ImageToTextTask" );
    }

    async resolveRecaptchaV2 ( websiteUrl, websiteKey ) {
        var res = await this.#request( "post", "createTask", {
            "task": {
                "type": "RecaptchaV2TaskProxyless",
                "websiteURL": websiteUrl,
                websiteKey,
            },
        } );

        if ( !res.ok ) return res;

        res = await this.#getTaskResult( res.data.taskId, "recaptchaV2TaskProxyless" );

        if ( res.ok ) {
            res.meta.cookies = res.data.cookies;
            res.data = res.data.gRecaptchaResponse;
        }

        return res;
    }

    // proptected
    async _reportIncorrect ( captcha ) {

        // image
        if ( captcha.type === "ImageToTextTask" ) {
            return this.#request( "post", "reportIncorrectImageCaptcha", {
                "taskId": captcha.id,
            } );
        }

        // re-captcha
        else if ( RECAPTCHA_TYPES.has( captcha.type ) ) {
            return this.#request( "post", "reportIncorrectRecaptcha", {
                "taskId": captcha.id,
            } );
        }
    }

    // private
    async #request ( method, path, body = {} ) {
        body.clientKey = this.#apiToken;

        const res = await fetch( "https://api.anti-captcha.com/" + path, {
            method,
            "agent": this.agent,
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

    async #getTaskResult ( taskId, type ) {
        while ( 1 ) {
            await sleep( DEFAULT_TIMEOUT );

            const res = await this.#request( "post", "getTaskResult", { taskId } );

            if ( !res.ok ) return new Captcha( this, taskId, type, res, null, null );

            if ( res.data.status === "ready" ) {
                return new Captcha( this, taskId, type, res, res.data.solution, {
                    "cost": +res.data.cost,
                    "createTime": res.data.createTime,
                    "endTime": res.data.endTime,
                    "solveCount": res.data.solveCount,
                } );
            }
        }
    }
}