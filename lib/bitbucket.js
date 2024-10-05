import fs from "node:fs";

import fetch from "#core/fetch";
import FormData from "#core/form-data";

export default class Bitbucket {
    #username;
    #password;
    #auth;

    constructor ( { username, password } = {} ) {
        this.#username = username;
        this.#password = password;
    }

    // public
    // https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/{workspace}/{repo_slug}/downloads#get
    async downloads ( repo ) {
        const res = await this.#req( "get", `/repositories/${ repo }/downloads` );

        return res;
    }

    // https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/{workspace}/{repo_slug}/downloads#post
    async upload ( repo, name, path ) {
        const form = new FormData();

        form.append( "files", fs.createReadStream( path ), {
            "filename": name,
        } );

        const res = await fetch( `https://api.bitbucket.org/2.0/repositories/${ repo }/downloads`, {
            "method": "post",
            "headers": {
                ...form.getHeaders(),
                "Authorization": this.#getAuth(),
            },
            "body": form,
        } );

        return result( res );
    }

    // private
    #getAuth () {
        this.#auth ??= "Basic " + Buffer.from( this.#username + ":" + this.#password ).toString( "base64" );

        return this.#auth;
    }

    async #req ( method, endpoint, data ) {
        const res = await fetch( "https://api.bitbucket.org/2.0" + endpoint, {
            method,
            "headers": {
                "Authorization": this.#getAuth(),
                "Content-Type": "application/json",
            },
        } );

        const json = await res.json();

        return result( 200, json );
    }
}
