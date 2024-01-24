import fetch from "#core/fetch";
import { CaptchaApi, Captcha } from "#lib/_captcha";

const DEFAULT_TIMEOUT = 3000;

const RECAPTCHA_TYPES = new Set( [ "recaptchaV2" ] );

const IMAGE_CAPTCHA_TYPE = {
    "numbers": 1, // only numbers are allowed
    "letters": 2, // any letters are allowed except numbers
};

export default class Anticaptcha extends CaptchaApi {
    #apiToken;

    constructor ( apiToken, options ) {
        super( options );

        this.apiToken = apiToken;
    }

    // properties
    get apiToken () {
        return this.#apiToken;
    }

    set apiToken ( value ) {
        this.#apiToken = value;
    }

    // public
    async getBalance () {
        const res = await this.#request( "getBalance" );

        if ( res.ok ) res.data = res.data.balance;

        return res;
    }

    async resolveImageCaptcha ( image, { signal, phrase, caseSensitive, numeric, calc, minLength, maxLength, instructions, websiteUrl } = {} ) {
        if ( numeric && !IMAGE_CAPTCHA_TYPE[ numeric ] ) throw `Numeric value is invalid`;

        var res = await this.#request(
            "createTask",
            {
                "task": {
                    "type": "ImageToTextTask",
                    "body": typeof image === "string" ? image : image.toString( "base64" ),
                    phrase,
                    "case": caseSensitive,
                    "numeric": numeric ? IMAGE_CAPTCHA_TYPE[ numeric ] : 0,
                    "math": calc,
                    minLength,
                    maxLength,
                    "comment": instructions,
                    "websiteURL": websiteUrl,
                },
            },
            signal
        );

        if ( !res.ok ) return res;

        res = await this.#getResult( res.data.taskId, "imageCaptcha", signal );

        if ( res.ok ) {

            // res.meta.url = res.data.url;
            res.data = res.data.text;
        }

        return res;
    }

    async resolveRecaptchaV2 ( websiteUrl, websiteKey, { signal } = {} ) {
        var res = await this.#request(
            "createTask",
            {
                "task": {
                    "type": "RecaptchaV2TaskProxyless",
                    "websiteURL": websiteUrl,
                    websiteKey,
                },
            },
            signal
        );

        if ( !res.ok ) return res;

        res = await this.#getResult( res.data.taskId, "recaptchaV2", signal );

        if ( res.ok ) {

            // res.meta.cookies = res.data.cookies;
            res.data = res.data.gRecaptchaResponse;
        }

        return res;
    }

    // proptected
    async _reportIncorrect ( captcha ) {

        // image
        if ( captcha.type === "imageCaptcha" ) {
            return this.#request( "reportIncorrectImageCaptcha", {
                "taskId": captcha.id,
            } );
        }

        // re-captcha
        else if ( RECAPTCHA_TYPES.has( captcha.type ) ) {
            return this.#request( "reportIncorrectRecaptcha", {
                "taskId": captcha.id,
            } );
        }
    }

    // private
    async #request ( path, params = {}, signal ) {
        params.clientKey = this.#apiToken;

        const body = JSON.stringify( params );

        const url = "https://api.anti-captcha.com/" + path;

        while ( 1 ) {
            const res = await fetch( url, {
                "method": "post",
                "agent": this._agent,
                signal,
                "headers": {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body,
            } );

            if ( !res.ok ) return res;

            try {
                var data = await res.json();
            }
            catch ( e ) {
                return result.catch( e, { "silent": true, "keepError": true } );
            }

            // captcha not ready
            if ( data.status === "processing" ) {
                await this._sleep( DEFAULT_TIMEOUT, signal );
            }

            // no slots available
            else if ( data.errorCode === "ERROR_NO_SLOT_AVAILABLE" ) {
                await this._sleep( DEFAULT_TIMEOUT, signal );
            }

            // error
            else if ( data.errorDescription ) {
                return result( [ 500, data.errorDescription ] );
            }

            // ok
            else {
                return result( 200, data );
            }
        }
    }

    async #getResult ( id, type, signal ) {
        while ( 1 ) {
            await this._sleep( DEFAULT_TIMEOUT, signal );

            const res = await this.#request( "getTaskResult", { "taskId": id }, signal );

            // ok
            if ( res.ok ) {
                return new Captcha( this, id, type, res, res.data.solution, {
                    "cost": +res.data.cost,

                    // "createTime": res.data.createTime,
                    // "endTime": res.data.endTime,
                    // "solveCount": res.data.solveCount,
                } );
            }

            // error
            else {
                return new Captcha( this, id, type, res, null, null );
            }
        }
    }
}
