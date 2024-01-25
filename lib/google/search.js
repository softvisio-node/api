import fetch from "#core/fetch";
import { encode as uuleEncode } from "#core/api/google/uule";
import { DOMParser } from "linkedom";
import Api from "#core/api";
import ProxyClient from "#core/proxy";
import randomLocation from "random-location";
import { quoteMeta } from "#core/utils";

export default class GoogleSearch {
    #proxy;
    #datasets;
    #maxRetries;
    #agent;

    constructor ( { proxy, datasets, maxRetries = 10 } = {} ) {
        this.#proxy = ProxyClient.new( proxy );
        this.#datasets = Api.new( datasets ).unref();
        this.#maxRetries = maxRetries;
        this.#agent = new fetch.Agent( { "keepAlive": true, "keepAliveMsecs": 300000, "proxy": this.#proxy } );
    }

    // public
    async search ( { keyword, target, maxResults = 100, location, randomCoordinates = false, minDistance, maxDistance, proxy, language } ) {
        if ( proxy ) proxy = ProxyClient.new( proxy );

        target = this.#createRegExp( target );

        var coordinates;

        if ( typeof location === "string" ) {
            if ( randomCoordinates ) {
                const geolocation = await this.#datasets.call( "geotargets/get-geotarget", location, { "random_coordinates": randomCoordinates } );

                if ( !geolocation.data?.random_coordinates ) return result( [ 500, `Unable to get random coordinates for location` ] );

                coordinates = geolocation.data.random_coordinates;
            }
            else {
                const geolocation = await this.#datasets.call( "geotargets/get-geotarget", location, { "geocode": true } );

                coordinates = geolocation.data?.geocode?.geometry?.location;

                if ( !coordinates ) return result( [ 500, `Unable to get coordinates for location` ] );

                coordinates = { "latitude": coordinates.lat, "longitude": coordinates.lng };
            }
        }
        else {
            coordinates = location;
        }

        if ( maxDistance ) {
            coordinates = randomLocation.randomAnnulusPoint( coordinates, minDistance || 0, maxDistance );
        }

        const uule = uuleEncode( coordinates ),
            results = [];

        var start = 0,
            url = `https://www.google.com/search?q=` + encodeURIComponent( keyword );

        if ( language ) url += "&hl=" + language;

        const agent = proxy
            ? new fetch.Agent( {
                "keepAlive": true,
                "proxy": proxy,
            } )
            : this.#agent;

        COLLECT_RESULTS: while ( 1 ) {
            let res, text;

            let num = maxResults - results.length + 10;
            if ( num > 100 ) num = 100;

            let _url = url + "&num=" + num;
            if ( start ) _url += "&start=" + start;

            for ( let retry = 0; retry < this.#maxRetries; retry++ ) {
                try {
                    res = await fetch( _url, {
                        agent,
                        "headers": { "Cookie": "UULE=" + uule },
                        "browser": true,
                    } );

                    if ( !res.ok ) throw res;

                    text = await res.text();

                    break;
                }
                catch ( e ) {
                    res = result.catch( e, { "silent": false, "keepError": false } );
                }
            }

            if ( !res.ok ) return res;

            const document = new DOMParser().parseFromString( text, "text/html" );

            const links = document.querySelectorAll( `div.g` );

            for ( const el of links ) {
                const item = {
                    "position": results.length + 1,
                    "title": el.querySelector( "h3" )?.textContent,
                    "description": el.querySelector( "div.IsZvec" )?.textContent,
                    "url": el.querySelector( "div.yuRUbf > a" )?.getAttribute( "href" ),
                };

                results.push( item );

                if ( target ) {
                    let url;

                    try {
                        url = new URL( item.url );
                        url = url.hostname + url.pathname;
                    }
                    catch ( e ) {}

                    // target found
                    if ( url && target.test( url ) ) return result( 200, item );
                }

                if ( results.length >= maxResults ) break COLLECT_RESULTS;
            }

            const next = document.querySelector( "a#pnnext" );

            if ( !next ) break;

            start += num;

            // url = new URL( next.getAttribute( "href" ), url );
        }

        if ( target ) return result( 200 );
        else return result( 200, results );
    }

    // private
    #createRegExp ( target ) {
        if ( !target ) return;

        if ( target.startsWith( "*." ) ) target = target.substring( 2 );

        target = quoteMeta( target );

        target = "(.*\\.)?" + target;

        if ( target.endsWith( "\\*" ) ) target = target.slice( 0, -2 ) + ".*";

        if ( !target.includes( "/" ) ) target += "\\/.*";

        target = new RegExp( "^" + target + "$", "i" );

        return target;
    }
}
