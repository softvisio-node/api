import fetch from "#core/fetch";
import ThreadsPool from "#core/threads/pool";

// NOTE https://seo-rank.my-addr.com/how-to-use-bulk-and-api-checker.php

const DEFAULT_MAX_RUNNING_THREADS = 5;

export default class SeoRank extends ThreadsPool {
    #apiKey;

    constructor ( apiKey ) {
        super();

        this.#apiKey = apiKey;

        this.maxRunningThreads = DEFAULT_MAX_RUNNING_THREADS;
    }

    // public
    async test () {
        return result( await this.getMoz( "www.google.com" ) );
    }

    async getMoz ( domain ) {
        return this.runThread( this.#thread.bind( this ), `https://seo-rank.my-addr.com/api2/moz/${ this.#apiKey }/${ domain }` );
    }

    // XXX up to 40 threads
    // XXX do not use this shit
    async getMajestic ( url ) {
        return this.runThread( this.#thread.bind( this ), `https://seo-rank.my-addr.com/api3/${ this.#apiKey }/${ url }` );
    }

    // private
    async #thread ( url ) {
        const res = await fetch( url );

        if ( !res.ok ) return res;

        const data = await res.text();

        if ( data === "incorrect_secret" ) return result( 401 );
        else if ( data === "added" ) return result( 200, "added" );
        else if ( data === "progress" ) return result( 200, "processing" );

        return result( 200, JSON.parse( data ) );
    }
}
