import fetch from "#core/fetch";
import { sleep } from "#core/utils";
import ThreadsPool from "#core/threads/pool";

// NOTE https://moz.com/help/links-api, click on "making calls" to open api endpoints

const DEFAULT_MAX_RUNNING_THREADS = 5;

export default class Moz extends ThreadsPool {
    #apiUser;
    #apiKey;

    #free; // free or paid api
    #useInterval; // use interval between requests, used for moz free api account
    #interval = 10_000; // interval between requests, used for moz free api account

    #dispatcher;
    #auth;
    #lastReqTime;

    constructor ( apiUser, apiKey, { proxy, free, useInterval, maxRunningThreads } = {} ) {
        super();

        this.#apiUser = apiUser;
        this.#apiKey = apiKey;

        this.proxy = proxy;
        this.#free = free;
        this.#useInterval = this.#free
            ? true
            : useInterval == null
                ? false
                : useInterval;

        this.maxRunningThreads = this.#free
            ? 1
            : maxRunningThreads || DEFAULT_MAX_RUNNING_THREADS;
    }

    // properties
    set proxy ( proxy ) {
        this.#getDispatcher().proxy = proxy;
    }

    // public
    async test () {
        return result( await this.getUrlMetrics( "www.google.com" ) );
    }

    // https://moz.com/help/links-api/making-calls/anchor-text-metrics
    // scope: page, subdomain, root_domain
    // limit: 1-50
    async getAnchorText ( target, scope, { limit } = {} ) {
        return this.runThread( this.#thread.bind( this ), "anchor_text", { target, scope, "limit": limit || null } );
    }

    // XXX https://moz.com/help/links-api/making-calls/final-redirect
    async getFinalRedirect () {}

    // XXX https://moz.com/help/links-api/making-calls/global-top-pages
    async getGlobalTopPages () {}

    // XXX https://moz.com/help/links-api/making-calls/global-top-root-domains
    async getGlobalTopRootDomains () {}

    // XXX https://moz.com/help/links-api/making-calls/index-metadata
    async getIndexMetadata () {}

    // https://moz.com/help/links-api/making-calls/link-intersect
    async getLinkIntersect () {}

    // XXX https://moz.com/help/links-api/making-calls/link-status
    async getLinkStatus () {}

    // XXX https://moz.com/help/links-api/making-calls/linking-root-domains
    async getLinkingRootDomains () {}

    // XXX https://moz.com/help/links-api/making-calls/link-metrics
    async getLinks () {}

    // XXX https://moz.com/help/links-api/making-calls/top-pages-metrics
    async getTopPages () {}

    // https://moz.com/help/links-api/making-calls/url-metrics
    // urls - up to 50 urls
    // da = domain_authority - Domain Authority, a normalized 100-point score representing the likelihood of a domain to rank well in search engine results
    // pa = page_authority - Page Authority, a normalized 100-point score representing the likelihood of a page to rank well in search engine results
    async getUrlMetrics ( url ) {
        return this.runThread( this.#thread.bind( this ), "url_metrics", {
            "targets": Array.isArray( url )
                ? url
                : [ url ],
        } );
    }

    // XXX https://moz.com/help/links-api/making-calls/usage-data
    async getUsageData () {}

    // private
    #getDispatcher () {
        this.#dispatcher ??= new fetch.Dispatcher();

        return this.#dispatcher;
    }

    #getAuth () {
        if ( !this.#auth ) this.#auth = "Basic " + Buffer.from( this.#apiUser + ":" + this.#apiKey ).toString( "base64" );

        return this.#auth;
    }

    async #thread ( endpoint, params ) {
        if ( this.#useInterval ) {
            const timeout = this.#lastReqTime + this.#interval - Date.now();

            if ( timeout > 0 ) await sleep( timeout );
        }

        const res = await fetch( "https://lsapi.seomoz.com/v2/" + endpoint, {
            "method": "POST",
            "dispatcher": this.#getDispatcher(),
            "headers": { "Authorization": this.#getAuth() },
            "body": JSON.stringify( params ),
        } );

        this.#lastReqTime = Date.now();

        if ( !res.ok ) {
            try {
                const data = await res.json();

                return result( [ res.status, data.message || res.statusText ] );
            }
            catch {
                return result( res );
            }
        }
        else {
            const data = await res.json();

            return result( 200, data );
        }
    }
}
