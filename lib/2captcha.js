import { CaptchaApi, Captcha } from "#lib/_captcha";
import fetch from "#core/fetch";

const DEFAULT_URL = "https://2captcha.com/";
const DEFAULT_TIMEOUT = 3000;

const IMAGE_CAPTCHA_TYPE = {
    "numbers": 1, // only numbers are allowed
    "letters": 2, // any letters are allowed except numbers
    "numbersOrLetters": 3, // captcha contains only numbers OR only letters
    "numbersAndLetters": 4, // captcha contains both numbers AND letters
};

export default class TwoCaptcha extends CaptchaApi {
    #apiToken;
    #apiUrl;

    constructor ( url, options ) {
        super( options );

        if ( url.startsWith( "http" ) ) url = new URL( url );

        if ( url instanceof URL ) {
            this.#apiToken = url.username;

            url.username = "";
            url.password = "";

            this.#apiUrl = url.toString();
        }
        else {
            this.#apiToken = url;
            this.#apiUrl = DEFAULT_URL;
        }
    }

    // public
    async getBalance () {
        const res = await this.#request( "res.php", { "action": "getbalance" } );

        if ( !res.ok ) return res;

        res.data = +res.data.request;

        return res;
    }

    async resolveImageCaptcha ( image, { signal, phrase, caseSensitive, numeric, calc, minLength, maxLength, comments, imageComments, isCyrillic, isLatin, language } = {} ) {
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
            "imginstructions": imageComments ? imageComments.toString( "base64" ) : null,
        };

        const res = await this.#resolve( params, signal );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.taskId, "imageCaptcha", signal );
    }

    async resolveRecaptchaV2 ( websiteUrl, websiteKey, { signal, invisible, datas, userAgent, cookies } = {} ) {
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

        const res = await this.#resolve( params, signal );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.taskId, "recaptchaV2", signal );
    }

    // proptected
    async _reportIncorrect ( captcha ) {
        const res = await this.#request( "res.php", { "action": "reportbad", "id": captcha.id } );

        if ( !res.ok ) return res;

        res.data = res.data.request;

        return res;
    }

    // private
    async #request ( path, params, signal ) {
        const body = new URLSearchParams( params );

        body.set( "key", this.#apiToken );
        body.set( "json", 1 );

        // submit
        while ( 1 ) {
            const res = await fetch( this.#apiUrl + path, {
                "method": "post",
                "agent": this._agent,
                signal,
                "headers": { "Content-Type": "application/www-form-urlencoded" },
                "body": body.toString(),
            } );

            // error
            if ( !res.ok ) return res;

            try {
                var data = await res.json();
            }
            catch ( e ) {
                return result.catch( e, { "silent": true, "keepError": true } );
            }

            // ok
            if ( data.status ) {
                return result( 200, data );
            }

            // no slots avail., repeat
            else if ( data.request === "ERROR_NO_SLOT_AVAILABLE" ) {
                await this._sleep( DEFAULT_TIMEOUT, signal );
            }

            // error
            else {
                return result( [500, data.error_text] );
            }
        }
    }

    async #resolve ( params, signal ) {
        const body = new URLSearchParams( params );

        body.set( "key", this.#apiToken );
        body.set( "json", 1 );

        // submit
        while ( 1 ) {
            const res = await fetch( this.#apiUrl + "in.php", {
                "method": "post",
                "agent": this._agent,
                signal,
                "headers": { "Content-Type": "application/www-form-urlencoded" },
                "body": body.toString(),
            } );

            // error
            if ( !res.ok ) return res;

            try {
                var data = await res.json();
            }
            catch ( e ) {
                return result.catch( e, { "silent": true, "keepError": true } );
            }

            // ok
            if ( data.status ) {
                return result( 200, { "taskId": data.request } );
            }

            // no slots avail., repeat
            else if ( data.request === "ERROR_NO_SLOT_AVAILABLE" ) {
                await this._sleep( DEFAULT_TIMEOUT, signal );
            }

            // error
            else {
                return result( [500, data.error_text] );
            }
        }
    }

    async #getResult ( id, type, signal ) {
        const url = `${this.#apiUrl}res.php?key=${this.#apiToken}&json=1&action=get2&id=${id}`;

        // get result
        while ( 1 ) {
            await this._sleep( DEFAULT_TIMEOUT, signal );

            const res = await fetch( url, { "agent": this._agent, signal } );

            if ( !res.ok ) return res;

            try {
                var data = await res.json();
            }
            catch ( e ) {
                return result.catch( e, { "silent": true, "keepError": true } );
            }

            // solved
            if ( data.status ) {
                return new Captcha( this, id, type, 200, data.request, { "cost": +data.price } );
            }

            // not ready
            else if ( data.request === "CAPCHA_NOT_READY" ) {
                continue;
            }

            // error
            else {
                return new Captcha( this, id, type, [500, data.request], null, null );
            }
        }
    }
}
