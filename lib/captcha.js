import result from "#core/result";

export class Captcha extends result.Result {
    #api;
    #id;
    #type;
    #isReported;

    constructor ( api, id, type, res, data, meta ) {
        super( res, data, meta );

        this.#api = api;
        this.#id = id;
        this.#type = type;
    }

    // properties
    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get isReported () {
        return this.#isReported;
    }

    set isReported ( value ) {
        this.#isReported = true;
    }

    // public
    async reportIncorrect () {
        return this.#api.reportIncorrect( this );
    }
}

export class CaptchaApi {
    async reportIncorrect ( captcha ) {
        if ( captcha.isReported || !captcha.ok || !captcha.id ) return;

        captcha.isReported = true;

        return this._reportIncorrect( captcha );
    }
}
