import fetch from "#core/fetch";
import ThreadsPool from "#core/threads/pool";

const DEFAULT_MAX_RUNNING_THREADS = 10;

export default class ArchiveOrg extends ThreadsPool {
    #dispatcher;

    constructor ( { maxRunningThreads, proxy } = {} ) {
        super();

        this.proxy = proxy;

        this.maxRunningThreads = maxRunningThreads || DEFAULT_MAX_RUNNING_THREADS;
    }

    // properties
    set proxy ( proxy ) {
        this.#getDispatcher().proxy = proxy;
    }

    // public
    // fields: "urlkey","timestamp","original","mimetype","statuscode","digest","length"
    async getIndex ( domain ) {
        const url = `https://web.archive.org/cdx/search/cdx?url=${ domain }&matchType=exact&fl=timestamp&filter=statuscode:200&filter=mimetype:text/html&output=json&from=2010&collapse=timestamp:6`;

        const res = await this.runThread( this.#thread.bind( this, url ) );

        if ( !res.ok ) return res;

        res.data = JSON.parse( res.data );

        const header = res.data.shift();

        res.data = res.data.map( item => Object.fromEntries( item.map( ( field, idx ) => [ header[ idx ], field ] ) ) );

        return res;
    }

    async getSnapshot ( domain, timestamp ) {
        const url = `https://web.archive.org/web/${ timestamp }/${ domain }/`;

        return await this.runThread( this.#thread.bind( this, url ) );
    }

    // private
    #getDispatcher () {
        this.#dispatcher ??= new fetch.Dispatcher();

        return this.#dispatcher;
    }

    async #thread ( url ) {
        const res = await fetch( url, {
            "dispatcher": this.#getDispatcher(),
            "browser": true,
        } );

        if ( res.ok ) {
            const data = await res.text();

            return result( 200, data );
        }
        else {
            return result( res );
        }
    }
}
