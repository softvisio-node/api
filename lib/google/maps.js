import fetch from "#core/fetch";
import Signal from "#core/threads/signal";

export default class GoogleMapsApi {
    #apiKey;
    #cache;
    #requests = {};

    constructor ( apiKey, { cache } = {} ) {
        this.#apiKey = apiKey;
        this.#cache = cache;

        if ( this.#cache ) this.#cache.decode = value => result.parse( value );
    }

    // public
    // https://developers.google.com/maps/documentation/geocoding/requests-geocoding
    async geocode ( address ) {
        return this.#request( "geocode:" + address, { address } );
    }

    // https://developers.google.com/maps/documentation/timezone/requests-timezone
    async timezone ( coordinates, { timestamp } = {} ) {
        const location = coordinates.latitude + "," + coordinates.longitude;

        return this.#request( "timezone:" + location + "/" + timestamp, { location, timestamp } );
    }

    // private
    async #request ( cacheId, params ) {
        var res = this.#cache?.get( cacheId );

        if ( res ) return res;

        if ( this.#requests[cacheId] ) return ( this.#requests[cacheId].signal ||= new Signal() ).wait();

        this.#requests[cacheId] = {};

        const url = new URL( `https://maps.googleapis.com/maps/api/geocode/json?key=${this.#apiKey}` );
        for ( const [name, value] of Object.entries( params ) ) url.searchParams.set( name, value );

        try {
            res = await fetch( url );

            if ( !res.ok ) throw result( res );

            const json = await res.json();

            res = result( 200, json.results );
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true } );
        }

        if ( this.#cache ) this.#cache.set( cacheId, res );

        this.#requests[cacheId]?.signal?.broadcast( res );
        delete this.#requests[cacheId];

        return res;
    }
}
