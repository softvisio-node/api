import fetch from "#core/fetch";
import Signal from "#core/threads/signal";

export default class GoogleMapsApi {
    #apiKey;
    #cache;
    #requests = {};

    constructor ( apiKey, { cache } = {} ) {
        if ( !apiKey ) throw Error( `Google maps API key is required` );

        this.#apiKey = apiKey;
        this.#cache = cache;

        if ( this.#cache ) this.#cache.decode = value => result.parse( value );
    }

    // public
    // https://developers.google.com/maps/documentation/geocoding/requests-geocoding
    async geocode ( address ) {
        return this.#request( "geocode", "geocode:" + address, { address }, "results" );
    }

    // https://developers.google.com/maps/documentation/timezone/requests-timezone
    async timezone ( coordinates, { timestamp } = {} ) {
        const location = coordinates.latitude + "," + coordinates.longitude;

        timestamp ||= 1;

        return this.#request( "timezone", "timezone:" + location + "/" + timestamp, { location, timestamp } );
    }

    // https://developers.google.com/maps/documentation/places/web-service/details
    // https://developers.google.com/maps/faq#languagesupport
    async placeDetails ( placeId, { language = "en" } = {} ) {
        return this.#request( "place/details", `place/details:${language}:${placeId}`, { "place_id": placeId, language }, "result" );
    }

    // private
    async #request ( type, cacheId, params, resultsProperty ) {
        var res = this.#cache?.get( cacheId );

        if ( res ) return res;

        if ( this.#requests[cacheId] ) return ( this.#requests[cacheId].signal ||= new Signal() ).wait();

        this.#requests[cacheId] = {};

        const url = new URL( `https://maps.googleapis.com/maps/api/${type}/json?key=${this.#apiKey}` );
        for ( const [name, value] of Object.entries( params ) ) if ( value ) url.searchParams.set( name, value );

        try {
            res = await fetch( url );

            if ( !res.ok ) throw result( res );

            const json = await res.json();

            if ( json.status === "OK" ) res = result( 200, resultsProperty ? json[resultsProperty] : json );
            else if ( json.status === "ZERO_RESULTS" ) res = result( 200 );
            else res = result( [400, json.errorMessage || json.error_message] );
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true } );
        }

        if ( this.#cache && res.ok ) this.#cache.set( cacheId, res );

        this.#requests[cacheId]?.signal?.broadcast( res );
        delete this.#requests[cacheId];

        return res;
    }
}
