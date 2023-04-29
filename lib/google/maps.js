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

        if ( this.#cache ) this.#cache.decode = value => result.fromJson( value );
    }

    // public
    // https://developers.google.com/maps/documentation/geocoding/requests-geocoding
    // XXX bounds
    async geocoding ( address, { language = "en", components, bounds } = {} ) {
        const params = { address };

        if ( language ) params.language = language;

        if ( components ) {
            params.components = Object.entries( components )
                .map( ( [key, values] ) => {
                    if ( !Array.isArray( values ) ) values = [values];

                    return values.map( value => `${key}:${value}` ).join( "|" );
                } )
                .join( "|" );
        }

        return this.#request( "geocode", "geocode:" + address, params, "results" );
    }

    // https://developers.google.com/maps/documentation/timezone/requests-timezone
    async timezone ( location, { timestamp = 1, language = "en" } = {} ) {
        const params = { timestamp };

        if ( language ) params.language = language;

        if ( location ) {
            if ( typeof location === "string" ) {
                params.location = location;
            }
            else if ( Array.isArray( location ) ) {
                params.location = location.join( "," );
            }
            else if ( location.lat ) {
                params.location = `${location.lat},${location.lng}`;
            }
            else {
                params.location = `${location.latitude},${location.longitude}`;
            }
        }

        return this.#request( "timezone", "timezone:" + location + "/" + timestamp, params );
    }

    // https://developers.google.com/maps/documentation/places/web-service/details
    // https://developers.google.com/maps/faq#languagesupport
    async getPlaceDetails ( placeId, { language = "en", fields, sessionToken } = {} ) {
        const params = {
            "place_id": placeId,
        };

        if ( language ) params.language = language;

        if ( fields ) {
            if ( !Array.isArray( fields ) ) fields = [fields];

            params.fields = fields.join( "," );
        }

        if ( sessionToken ) params.sessiontoken = sessionToken;

        return this.#request( "place/details", `place/details:${language}:${placeId}`, params, "result" );
    }

    // https://developers.google.com/maps/documentation/places/web-service/search-find-place
    async findPlaceFromText ( text, { language = "en", fields, locationBias } = {} ) {
        const params = {
            "input": text,
            "inputtype": "textquery",
        };

        if ( language ) params.language = language;

        if ( fields ) {
            if ( !Array.isArray( fields ) ) fields = [fields];

            params.fields = fields.join( "," );
        }

        if ( locationBias ) params.locationbias = locationBias;

        return this.#request( "place/findplacefromtext", null, params, "candidates" );
    }

    // https://developers.google.com/maps/documentation/places/web-service/autocomplete
    async autocomplete ( text, { language = "en", components, types, location, radius, strictBounds, sessionToken } = {} ) {
        const params = { "input": text };

        if ( language ) params.language = language;

        if ( components ) {
            params.components = Object.entries( components )
                .map( ( [key, values] ) => {
                    if ( !Array.isArray( values ) ) values = [values];

                    return values.map( value => `${key}:${value}` ).join( "|" );
                } )
                .join( "|" );
        }

        if ( types ) {
            if ( !Array.isArray( types ) ) types = [types];

            params.types = types.join( "|" );
        }

        if ( location ) {
            if ( typeof location === "string" ) {
                params.location = location;
            }
            else if ( Array.isArray( location ) ) {
                params.location = location.join( "," );
            }
            else if ( location.lat ) {
                params.location = `${location.lat},${location.lng}`;
            }
            else {
                params.location = `${location.latitude},${location.longitude}`;
            }
        }

        if ( radius ) params.radius = radius;

        if ( strictBounds ) params.strictbounds = true;

        if ( sessionToken ) params.sessiontoken = sessionToken;

        return this.#request( "place/autocomplete", null, params, "predictions" );
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
