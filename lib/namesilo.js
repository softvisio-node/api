import fetch from "#core/fetch";
import xml from "#core/xml";
import ThreadsPool from "#core/threads/pool";

// NOTE API reference: https://www.namesilo.com/api_reference.php#changeNameServers

// XXX max threads / api key !!!

const DEFAULT_MAX_RUNNING_THREADS = 2;

export default class Namesilo extends ThreadsPool {
    #apiKey;
    #dispatcher;

    constructor ( apiKey, { proxy, maxRunningThreads } = {} ) {
        super();

        this.#apiKey = Array.isArray( apiKey )
            ? apiKey
            : [ apiKey ];

        this.proxy = proxy;

        this.maxRunningThreads = maxRunningThreads || DEFAULT_MAX_RUNNING_THREADS;
    }

    // properties
    set proxy ( proxy ) {
        this.#getDispatcher().proxy = proxy;
    }

    // public
    // up to 200 domains
    async checkDomains ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [ domains ];

        const idx = Object.fromEntries( domains.map( domain => [ domain, false ] ) );

        const url = `https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=${ this.#getApiKey() }&domains=` + Object.keys( idx ).join( "," );

        const res = await this.runThread( this.#thread.bind( this ), url );

        if ( !res.ok ) return res;

        for ( const domain of res.data.available.domain ) {
            idx[ domain ] = true;
        }

        return result( 200, idx );
    }

    async listDomains () {
        const url = `https://www.namesilo.com/api/listDomains?version=1&type=xml&key=${ this.#getApiKey() }`;

        const res = await this.runThread( this.#thread.bind( this ), url );

        if ( !res.ok ) return res;

        return result( 200, res.data.domains.domain );
    }

    async listOrders () {
        const url = `https://www.namesilo.com/api/listOrders?version=1&type=xml&key=${ this.#getApiKey() }`;

        const res = await this.runThread( this.#thread.bind( this ), url );

        if ( !res.ok ) return res;

        return result( 200, res.data.order || [] );
    }

    async getDomainInfo ( domain ) {
        const url = `https://www.namesilo.com/api/getDomainInfo?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }`;

        return await this.runThread( this.#thread.bind( this ), url );
    }

    // NAME SERVERS
    async listRegisteredNameServers ( domain ) {
        const url = `https://www.namesilo.com/api/listRegisteredNameServers?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }`;

        const res = await this.runThread( this.#thread.bind( this ), url );

        if ( !res.ok ) return res;

        return result( 200, res.data.hosts );
    }

    async addRegisteredNameServer ( domain, newHost, ip1, options = {} ) {
        const ip = { ...options, ip1 };

        const url =
            `https://www.namesilo.com/api/addRegisteredNameServer?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }&new_host=${ newHost }&` +
            Object.keys( ip )
                .map( name => name + "=" + ip[ name ] )
                .join( "&" );

        return await this.runThread( this.#thread.bind( this ), url );
    }

    async modifyRegisteredNameServer ( domain, currentHost, newHost, ip1, options = {} ) {
        const ip = { ...options, ip1 };

        const url =
            `https://www.namesilo.com/api/modifyRegisteredNameServer?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }&current_host=${ currentHost }&new_host=${ newHost }&` +
            Object.keys( ip )
                .map( name => name + "=" + ip[ name ] )
                .join( "&" );

        return await this.runThread( this.#thread.bind( this ), url );
    }

    async deleteRegisteredNameServer ( domain, currentHost ) {
        const url = `https://www.namesilo.com/api/deleteRegisteredNameServer?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }&current_host=${ currentHost }`;

        return await this.runThread( this.#thread.bind( this ), url );
    }

    async changeNameServers ( domain, nameServers ) {
        const url =
            `https://www.namesilo.com/api/changeNameServers?version=1&type=xml&key=${ this.#getApiKey() }&domain=${ domain }&` +
            Object.keys( nameServers )
                .filter( ns => nameServers[ ns ] )
                .map( ns => ns + "=" + nameServers[ ns ] )
                .join( "&" );

        return await this.runThread( this.#thread.bind( this ), url );
    }

    // private
    #getDispatcher () {
        this.#dispatcher ??= new fetch.Dispatcher();

        return this.#dispatcher;
    }

    #getApiKey () {
        const apiKey = this.#apiKey.shift();

        this.#apiKey.push( apiKey );

        return apiKey;
    }

    async #thread ( url ) {
        const res = await fetch( url, {
            "dispatcher": this.#getDispatcher(),
        } );

        if ( !res.ok ) return result( res );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [ 400, data.namesilo.reply.detail ] );

        return result( 200, data.namesilo.reply );
    }
}
