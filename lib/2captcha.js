import { CaptchaApi, Captcha } from "#lib/captcha";
import fetch from "#core/fetch";
import { sleep } from "#core/utils";

const DEFAULT_TIMEOUT = 3000;

const IMAGE_CAPTCHA_TYPE = {
    "numbers": 1, // only numbers are allowed
    "letters": 2, // any letters are allowed except numbers
    "numbersOrLetters": 3, // captcha contains only numbers OR only letters
    "numbersAndLetters": 4, // captcha contains both numbers AND letters
};

export default class TwoCaptcha extends CaptchaApi {
    #apiUrl;
    #apiKey;

    constructor ( url, options = {} ) {
        super( options );

        url = new URL( url );

        this.apiKey = url.username;

        url.username = "";
        this.#apiUrl = url.toString();
    }

    // public
    // public
    async getBalance () {
        const res = await fetch( `${this.#apiUrl}res.php?key=${this.#apiKey}&json=1&action=getbalance`, {
            "agent": this.agent,
        } );

        if ( !res.ok ) return res;

        const data = await res.json();

        return result( 200, data );
    }

    async resolveImageCaptcha ( image, { phrase, caseSensitive, numeric, calc, minLength, maxLength, comments, isCyrillic, isLatin, language } = {} ) {
        if ( numeric && !IMAGE_CAPTCHA_TYPE[numeric] ) throw `Numeric value is invalid`;

        const params = {
            "method": "base64",
            "body": image.toString( "base64" ),
            phrase,
            "regsense": caseSensitive ? 1 : 0,
            "numeric": numeric ? IMAGE_CAPTCHA_TYPE[numeric] : null,
            "calc": calc ? 1 : 0,
            "min_len": minLength,
            "max_len": maxLength,
            "language": isCyrillic ? 1 : isLatin ? 2 : 0,
            "lang": language,
            "textinstructions": comments,
        };

        const res = await this.#resolve( params );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.taskId, "imageCaptcha" );
    }

    async resolveRecaptchaV2 ( websiteUrl, websiteKey, { invisible, datas, userAgent, cookies } = {} ) {
        var params;

        if ( invisible ) {
            params = {
                "method": "userrecaptcha",
                "googlekey": websiteKey,
                "pageurl": websiteUrl,
                "invisible": 1,
                "data-s": datas,
                "userAgent": userAgent,
                "cookies": cookies,
            };
        }
        else {
            params = {
                "method": "userrecaptcha",
                "googlekey": websiteKey,
                "pageurl": websiteUrl,
            };
        }

        const res = await this.#resolve( params );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.taskId, "recaptchaV2" );
    }

    // private
    async #resolve ( params ) {
        const body = new URLSearchParams( params );

        body.set( "key", this.#apiKey );
        body.set( "json", 1 );

        // submit
        while ( 1 ) {
            const res = await fetch( this.#apiUrl + "in.php", {
                "method": "post",
                "agent": this.agent,
                "headers": { "Content-Type": "application/x-www-form-urlencoded" },
                "body": body.toString(),
            } );

            // error
            if ( !res.ok ) return res;

            const data = await res.json();

            // ok
            if ( data.status ) {
                return result( 200, { "taskId": data.request } );
            }

            // no slots avail., repeat
            else if ( data.request === "ERROR_NO_SLOT_AVAILABLE" ) {
                await sleep( DEFAULT_TIMEOUT );
            }

            // error
            else {
                return result( [500, data.request] );
            }
        }
    }

    async #getResult ( taskId, type ) {
        const url = `${this.#apiUrl}res.php?key=${this.#apiKey}&json=1&action=get&id=${taskId}`;

        // get result
        while ( 1 ) {
            await sleep( DEFAULT_TIMEOUT );

            const res = await fetch( url, {
                "agent": this.agent,
            } );

            if ( !res.ok ) return res;

            const data = await res.json();

            // solved
            if ( data.status ) {
                return new Captcha( this, taskId, type, 200, data.request, {
                    "cost": +data.price,
                } );
            }

            // error
            else if ( data.request !== "CAPCHA_NOT_READY" ) {
                return new Captcha( this, taskId, type, [500, data.request], null, null );
            }
        }
    }
}
