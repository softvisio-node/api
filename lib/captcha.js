import result from "#core/result";

export default class Captcha extends result.Result {
    #api;
    #id;
    #type;
    #reported;

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

    // public
    async reportInvalid () {
        if ( this.#reported ) return;

        this.#reported = true;

        if ( !this.ok ) return;

        return this.#api.reportInvalid( this );
    }
}
