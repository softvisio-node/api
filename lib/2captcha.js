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
            this.apiToken = url.username;

            url.username = "";
            url.password = "";

            this.#apiUrl = url.toString();
        }
        else {
            this.apiToken = url;
            this.#apiUrl = DEFAULT_URL;
        }
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
        const res = await this.#request( "res.php", { "action": "getbalance" } );

        if ( !res.ok ) return res;

        res.data = +res.data.request;

        return res;
    }

    async resolveImageCaptcha ( image, { signal, phrase, caseSensitive, numeric, calc, minLength, maxLength, instructions, isCyrillic, isLatin, language } = {} ) {
        if ( numeric && !IMAGE_CAPTCHA_TYPE[ numeric ] ) throw `Numeric value is invalid`;

        const params = {
            "method": "base64",
            "body": typeof image === "string" ? image : image.toString( "base64" ),
            "phrase": phrase ? 1 : 0,
            "regsense": caseSensitive ? 1 : 0,
            "numeric": numeric ? IMAGE_CAPTCHA_TYPE[ numeric ] : null,
            "calc": calc ? 1 : 0,
            "min_len": minLength || 0,
            "max_len": maxLength || 0,
            "language": isCyrillic ? 1 : isLatin ? 2 : 0,
            "lang": language || "",
        };

        if ( instructions ) {
            if ( typeof instructions === "string" ) params.textinstructions = instructions;
            else params.imginstructions = instructions.toString( "base64" );
        }

        const res = await this.#request( "in.php", params, signal );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.request, "imageCaptcha", signal );
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

        const res = await this.#request( "in.php", params, signal );

        if ( !res.ok ) return res;

        return this.#getResult( res.data.request, "recaptchaV2", signal );
    }

    // proptected
    async _reportIncorrect ( captcha ) {
        return this.#request( "res.php", { "action": "reportbad", "id": captcha.id } );
    }

    // private
    async #request ( path, params, signal ) {
        var body = new URLSearchParams( params );

        body.set( "key", this.#apiToken );
        body.set( "json", 1 );

        body = body.toString();

        const url = this.#apiUrl + path;

        // submit
        while ( true ) {
            const res = await fetch( url, {
                "method": "post",
                "dispatcher": this._agent,
                signal,
                "headers": { "Content-Type": "application/www-form-urlencoded" },
                body,
            } );

            // error
            if ( !res.ok ) return res;

            try {
                var data = await res.json();
            }
            catch ( e ) {
                return result.catch( e );
            }

            // ok
            if ( data.status ) {
                return result( 200, data );
            }

            // captcha not ready
            else if ( data.request === "CAPCHA_NOT_READY" ) {
                await this._sleep( DEFAULT_TIMEOUT, { signal } );
            }

            // no slots avail., repeat
            else if ( data.request === "ERROR_NO_SLOT_AVAILABLE" ) {
                await this._sleep( DEFAULT_TIMEOUT, { signal } );
            }

            // error
            else {
                return result( [ 500, data.error_text ] );
            }
        }
    }

    async #getResult ( id, type, signal ) {
        await this._sleep( DEFAULT_TIMEOUT, { signal } );

        const res = await this.#request( "res.php", { "action": "get2", id }, signal );

        // ok
        if ( res.ok ) {
            return new Captcha( this, id, type, res, res.data.request, {
                "cost": +res.data.price,
            } );
        }

        // error
        else {
            return new Captcha( this, id, type, res, null, null );
        }
    }
}
