/* tslint:disable */
/*
 * Copyright 2010-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

// import * as CryptoJS from 'crypto-js';
import sha256 from 'crypto-js/sha256.js';
import hmacSHA256 from 'crypto-js/hmac-sha256.js';
import Hex from 'crypto-js/enc-hex.js';

const SHA256 = sha256;
const encHex = Hex;
const HmacSHA256 = hmacSHA256;

const sigV4Client: { [key: string]: any } = {};

sigV4Client.newClient = function (config: any) {
    const AWS_SHA_256 = 'AWS4-HMAC-SHA256';
    const AWS4_REQUEST = 'aws4_request';
    const AWS4 = 'AWS4';
    const X_AMZ_DATE = 'x-amz-date';
    const X_AMZ_SECURITY_TOKEN = 'x-amz-security-token';
    const HOST = 'host';
    const AUTHORIZATION = 'Authorization';

    function hash(value: any) {
        return SHA256(value);
    }

    function hexEncode(value: any) {
        return value.toString(encHex);
    }

    function hmac(secret: any, value: any) {
        return HmacSHA256(value, secret); // eslint-disable-line
    }

    function buildCanonicalRequest(method: any, path: any, queryParams: any, headers: any, payload: any) {
        return (
            method +
            '\n' +
            buildCanonicalUri(path) +
            '\n' +
            buildCanonicalQueryString(queryParams) +
            '\n' +
            buildCanonicalHeaders(headers) +
            '\n' +
            buildCanonicalSignedHeaders(headers) +
            '\n' +
            hexEncode(hash(payload))
        );
    }

    function hashCanonicalRequest(request: any) {
        return hexEncode(hash(request));
    }

    function buildCanonicalUri(uri: any) {
        // eslint-disable-next-line no-constant-condition
        return 1 ? UriEncode(uri) : encodeURI(uri);
    }

    //! code from: https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
    //! '*' '+' '!' 같은 특수 문자가 들어갈 경우 인증 에러 발생할 수 있음.
    function UriEncode(input: any, encodeSlash = false) {
        const result = [];
        // const toHexUTF8 = (str: any) => {
        //     //TOOD - '한글' 인코딩시 utf8 으로 안하는듯.
        //     str = str || '';
        //     let hex = '';
        //     for (let i = 0; i < str.length; i++) {
        //         hex += '%' + str.charCodeAt(i).toString(16).toUpperCase();
        //     }
        //     return hex;
        // };
        for (let i = 0; i < input.length; i++) {
            const ch = input.charAt(i);
            if (
                (ch >= 'A' && ch <= 'Z') ||
                (ch >= 'a' && ch <= 'z') ||
                (ch >= '0' && ch <= '9') ||
                ch == '_' ||
                ch == '-' ||
                ch == '~' ||
                ch == '.'
            ) {
                result.push(ch);
            } else if (ch == '*') {
                //TODO - encodeURIComponent()에서 인코딩이 안되서, 강제로 인코딩됨.
                result.push('%2A');
            } else if (ch == '!') {
                //TODO - encodeURIComponent()에서 인코딩이 안되서, 강제로 인코딩됨.
                result.push('%21');
            } else if (ch == '(') {
                //TODO - encodeURIComponent()에서 인코딩이 안되서, 강제로 인코딩됨.
                result.push('%28');
            } else if (ch == ')') {
                //TODO - encodeURIComponent()에서 인코딩이 안되서, 강제로 인코딩됨.
                result.push('%29');
            } else if (ch == '/') {
                result.push(encodeSlash ? '%2F' : ch);
            } else {
                // result.push(1 ? hexEncode(ch) : toHexUTF8(ch));
                result.push(encodeURIComponent(ch));
            }
        }
        // console.log('! encode=',result.join('').toString(), '<-', input);
        return result.join('').toString();
    }

    function buildCanonicalQueryString(queryParams: any) {
        if (Object.keys(queryParams).length < 1) {
            return '';
        }

        const sortedQueryParams = [];
        for (const property in queryParams) {
            if (Object.prototype.hasOwnProperty.call(queryParams, property)) {
                sortedQueryParams.push(property);
            }
        }
        sortedQueryParams.sort();

        let canonicalQueryString = '';
        for (let i = 0; i < sortedQueryParams.length; i++) {
            canonicalQueryString +=
                sortedQueryParams[i] +
                '=' +
                //FIX - encoding problem: A-Z, a-z, 0-9, hyphen ( - ), underscore ( _ ), period ( . ), and tilde ( ~ ).
                // https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html.
                // encodeURIComponent(queryParams[sortedQueryParams[i]]) +
                urlencode(queryParams[sortedQueryParams[i]]) +
                '&';
        }
        return canonicalQueryString.substr(0, canonicalQueryString.length - 1);
    }

    //code from https://www.codeproject.com/Articles/1016044/JavaScript-URL-encode-decode-and-escape
    function urlencode(text: any) {
        return encodeURIComponent(text)
            .replace(/!/g, '%21')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A')
            .replace(/%20/g, '%20');
    }

    // function urldecode(text: any) {
    //     return decodeURIComponent((text + '').replace(/\+/g, '%20'));
    // }

    function buildCanonicalHeaders(headers: any) {
        let canonicalHeaders = '';
        const sortedKeys = [];
        for (const property in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, property)) {
                sortedKeys.push(property);
            }
        }
        sortedKeys.sort();

        for (let i = 0; i < sortedKeys.length; i++) {
            canonicalHeaders += sortedKeys[i].toLowerCase() + ':' + headers[sortedKeys[i]] + '\n';
        }
        return canonicalHeaders;
    }

    function buildCanonicalSignedHeaders(headers: any) {
        const sortedKeys = [];
        for (const property in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, property)) {
                sortedKeys.push(property.toLowerCase());
            }
        }
        sortedKeys.sort();

        return sortedKeys.join(';');
    }

    function buildStringToSign(datetime: any, credentialScope: any, hashedCanonicalRequest: any) {
        return AWS_SHA_256 + '\n' + datetime + '\n' + credentialScope + '\n' + hashedCanonicalRequest;
    }

    function buildCredentialScope(datetime: any, region: any, service: any) {
        return datetime.substr(0, 8) + '/' + region + '/' + service + '/' + AWS4_REQUEST;
    }

    function calculateSigningKey(secretKey: any, datetime: any, region: any, service: any) {
        return hmac(hmac(hmac(hmac(AWS4 + secretKey, datetime.substr(0, 8)), region), service), AWS4_REQUEST);
    }

    function calculateSignature(key: any, stringToSign: any) {
        return hexEncode(hmac(key, stringToSign));
    }

    function buildAuthorizationHeader(accessKey: any, credentialScope: any, headers: any, signature: any) {
        return (
            AWS_SHA_256 +
            ' Credential=' +
            accessKey +
            '/' +
            credentialScope +
            ', SignedHeaders=' +
            buildCanonicalSignedHeaders(headers) +
            ', Signature=' +
            signature
        );
    }

    const awsSigV4Client: { [key: string]: any } = {};

    if (config.accessKey === undefined || config.secretKey === undefined) {
        return awsSigV4Client;
    }

    awsSigV4Client.host = config.host;
    awsSigV4Client.accessKey = config.accessKey;
    awsSigV4Client.secretKey = config.secretKey;
    awsSigV4Client.sessionToken = config.sessionToken;
    awsSigV4Client.serviceName = config.serviceName || 'execute-api';
    awsSigV4Client.region = config.region || 'ap-northeast-2';
    awsSigV4Client.defaultAcceptType = config.defaultAcceptType || 'application/json';
    awsSigV4Client.defaultContentType = config.defaultContentType || 'application/json';

    const invokeUrl = config.endpoint;
    const endpoint = /(^https?:\/\/[^/]+)/g.exec(invokeUrl)[1];
    const pathComponent = invokeUrl.substring(endpoint.length);

    awsSigV4Client.endpoint = endpoint;
    awsSigV4Client.pathComponent = pathComponent;

    awsSigV4Client.signRequest = function (request: any) {
        const verb = request.method.toUpperCase();
        const path = awsSigV4Client.pathComponent + request.path;
        const queryParams = request.queryParams || {}; //{ ...request.queryParams };
        const headers = request.headers || {}; //{ ...request.headers };

        // If the user has not specified an override for Content type the use default
        if (headers['Content-Type'] === undefined) {
            headers['Content-Type'] = awsSigV4Client.defaultContentType;
        }

        // If the user has not specified an override for Accept type the use default
        if (headers['Accept'] === undefined) {
            headers['Accept'] = awsSigV4Client.defaultAcceptType;
        }

        let body = request.body || {}; //{ ...request.body };
        // override request body and set to empty when signing GET requests
        if (request.body === undefined || verb === 'GET') {
            body = '';
        } else {
            body = body && typeof body === 'object' ? JSON.stringify(body) : body;
        }

        // If there is no body remove the content-type header so it is not
        // included in SigV4 calculation
        if (body === '' || body === undefined || body === null) {
            delete headers['Content-Type'];
        }

        const datetime = new Date()
            .toISOString()
            .replace(/\.\d{3}Z$/, 'Z')
            .replace(/[:-]|\.\d{3}/g, '');
        headers[X_AMZ_DATE] = datetime;
        // let parser = new URL(awsSigV4Client.endpoint);
        // headers[HOST] = parser.hostname;
        headers[HOST] = awsSigV4Client.host;

        const canonicalRequest = buildCanonicalRequest(verb, path, queryParams, headers, body);
        const hashedCanonicalRequest = hashCanonicalRequest(canonicalRequest);
        const credentialScope = buildCredentialScope(datetime, awsSigV4Client.region, awsSigV4Client.serviceName);
        const stringToSign = buildStringToSign(datetime, credentialScope, hashedCanonicalRequest);
        const signingKey = calculateSigningKey(awsSigV4Client.secretKey, datetime, awsSigV4Client.region, awsSigV4Client.serviceName);
        const signature = calculateSignature(signingKey, stringToSign);

        headers[AUTHORIZATION] = buildAuthorizationHeader(awsSigV4Client.accessKey, credentialScope, headers, signature);
        if (awsSigV4Client.sessionToken !== undefined && awsSigV4Client.sessionToken !== '') {
            headers[X_AMZ_SECURITY_TOKEN] = awsSigV4Client.sessionToken;
        }
        delete headers[HOST];

        let url = awsSigV4Client.endpoint + path;
        const queryString = buildCanonicalQueryString(queryParams);
        if (queryString !== '') {
            url += '?' + queryString;
        }

        // Need to re-attach Content-Type if it is not specified at this point
        if (headers['Content-Type'] === undefined) {
            headers['Content-Type'] = awsSigV4Client.defaultContentType;
        }

        return {
            headers: headers,
            url: url,
        };
    };

    return awsSigV4Client;
};

export { sigV4Client };
