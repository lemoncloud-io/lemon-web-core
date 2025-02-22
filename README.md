<div align="center">
  <div>
    <h1 align="center">LemonWebCore</h1>
  </div>
  <p>
    LemonWebCore is a library designed for API requests and user authentication management in web-based projects for different cloud providers such as AWS, Azure, and GCP at LemonCloud.
  </p>
</div>

<div align="center" markdown="1">

[![lemoncloud](https://img.shields.io/badge/by-LEMONCLOUD-ED6F31?logo=github)](https://github.com/lemoncloud-io)
[![license](https://img.shields.io/badge/license-MIT-151515.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRiIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTMgNiAzIDFtMCAwLTMgOWE1IDUgMCAwIDAgNi4wMDEgME02IDdsMyA5TTYgN2w2LTJtNiAyIDMtMW0tMyAxLTMgOWE1IDUgMCAwIDAgNi4wMDEgME0xOCA3bDMgOW0tMy05LTYtMm0wLTJ2Mm0wIDE2VjVtMCAxNkg5bTMgMGgzIi8+PC9zdmc+)](https://github.com/lemoncloud-io/lemon-web-core/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@lemoncloud/lemon-web-core?logo=semanticrelease&label=release&color=C73659)](https://www.npmjs.com/package/@lemoncloud/lemon-web-core)
[![downloads](https://img.shields.io/npm/dt/@lemoncloud/lemon-web-core?color=A91D3A&logo=npm)](https://www.npmjs.com/package/@lemoncloud/lemon-web-core)

</div>

---

## Table of Contents

-   [Installation](#installation)
-   [Usage](#usage)
    -   [WebCoreFactory](#webcorefactory)
    -   [AWSWebCore](#awswebcore)
    -   [AzureWebCore](#azurewebcore)
-   [API Reference](#api-reference)
-   [Troubleshooting](#troubleshooting)

## Installation

You can install the LemonWebCore Library via npm:

```bash
npm install @lemoncloud/lemon-web-core
```

## Usage

The LemonWebCore Library allows you to create and use instances for different cloud providers. Below are the usage examples for WebCoreFactory, AWSWebCore, and AzureWebCore.
Please see [documentation](https://tech.lemoncloud.io/lemon-web-core/) for more information.

### WebCoreFactory

The `WebCoreFactory` is used to create instances of `AWSWebCore` or `AzureWebCore` based on the cloud provider configuration.

-   AWSWebCore

```typescript
import { WebCoreFactory, WebCoreConfig } from '@lemoncloud/lemon-web-core';

const config: WebCoreConfig<'aws'> = {
    cloud: 'aws',
    project: 'my-aws-project',
    oAuthEndpoint: 'https://example.com/oauth',
    region: 'us-west-2',
};
const awsWebCore = WebCoreFactory.create(config);
await awsWebCore.init();
```

-   AzureWebCore

```typescript
const azureConfig: WebCoreConfig<'azure'> = {
    cloud: 'azure',
    project: 'my-azure-project',
    oAuthEndpoint: 'https://example.com/oauth',
};

const azureWebCore = WebCoreFactory.create(azureConfig);
await azureWebCore.init();
```

### AWSWebCore

The `AWSWebCore` class handles AWS-specific web core operations. Here is an example of how to use it:

```typescript
import { AWSWebCore, WebCoreConfig } from '@lemoncloud/lemon-web-core';

const config: WebCoreConfig<'aws'> = {
    cloud: 'aws',
    project: 'my-aws-project',
    oAuthEndpoint: 'https://example.com/oauth',
    region: 'us-west-2',
};

const awsWebCore = new AWSWebCore(config);

// Initialize
await awsWebCore.init();

// Make a signed request
const response = await awsWebCore.signedRequest('GET', 'https://example.com/api/resource');
console.log(response.data);

// Make a signed request with Builder
const example = await awsWebCore
    .buildSignedRequest({
        method: 'GET',
        baseURL: `https://api.lemoncloud.io/v1/oauth`,
    })
    .setParams({ page: 0 })
    .setBody({ date: 'example' })
    .execute();

// Check authentication status
const isAuthenticated = await awsWebCore.isAuthenticated();
console.log(isAuthenticated);
```

### AzureWebCore

The `AzureWebCore` class handles Azure-specific web core operations. Here is an example of how to use it:

```typescript
import { AzureWebCore, WebCoreConfig } from '@lemoncloud/lemon-web-core';

const config: WebCoreConfig<'azure'> = {
    cloud: 'azure',
    project: 'my-azure-project',
    oAuthEndpoint: 'https://example.com/oauth',
};

const azureWebCore = new AzureWebCore(config);

// Initialize
await azureWebCore.init();

// Make a signed request
const response = await azureWebCore.signedRequest('GET', 'https://example.com/api/resource');
console.log(response.data);

// Make a signed request with Builder
const example = await azureWebCore
    .buildSignedRequest({
        method: 'GET',
        baseURL: `https://api.lemoncloud.io/v1/oauth`,
    })
    .setParams({ page: 0 })
    .setBody({ date: 'example' })
    .execute();

// Check authentication status
const isAuthenticated = await azureWebCore.isAuthenticated();
console.log(isAuthenticated);
```

## API Reference

### WebCoreFactory

-   `create<T extends WebCoreService>(config: WebCoreConfig<CloudProvider>): T`

Creates an instance of `AWSWebCore` or `AzureWebCore` based on the provided cloud provider configuration.

### AWSWebCore

-   `constructor(config: WebCoreConfig<'aws'>)`

Creates an instance of `AWSWebCore` with the specified configuration.

-   `init(): Promise<void>`

Initializes the AWSWebCore instance.

-   `signedRequest<T>(method: string, url: string, params?: Params, body?: Body, config?: AxiosRequestConfig): Promise<HttpResponse<T>>`

Makes a signed HTTP request.

-   `isAuthenticated(): Promise<boolean>`

Checks if the user is authenticated.

-   `saveOAuthToken(token: LemonOAuthToken): Promise<void>`

Saves the OAuth token.

-   `logout(): Promise<void>`

Logs the user out by clearing the OAuth token.

-   `setUseXLemonIdentity(use: boolean): Promise<void>`

Sets whether to use the x-lemon-identity header.

### AzureWebCore

-   `constructor(config: WebCoreConfig<'azure'>)`

Creates an instance of `AzureWebCore` with the specified configuration.

-   `init(): Promise<void>`

Initializes the AzureWebCore instance.

-   `signedRequest<T>(method: string, url: string, params?: Params, body?: Body, config?: AxiosRequestConfig): Promise<HttpResponse<T>>`

Makes a signed HTTP request.

-   `isAuthenticated(): Promise<boolean>`

Checks if the user is authenticated.

-   `saveOAuthToken(token: LemonOAuthToken): Promise<void>`

Saves the OAuth token.

-   `logout(): Promise<void>`

Logs the user out by clearing the OAuth token.

-   `setUseXLemonIdentity(use: boolean): Promise<void>`

Sets whether to use the x-lemon-identity header.

## Axios Instance Management

The WebCore provides a shared Axios instance management feature. This allows you to configure a single Axios instance that can be reused across multiple requests, which is particularly useful for setting up global interceptors or common configurations.

### Getting the Shared Axios Instance

```typescript
const webCore = WebCoreFactory.create({ cloud: 'aws', ... });
const axiosInstance = webCore.getSharedAxiosInstance();
```

### Setting Up Interceptors

```typescript
// Request Interceptor
webCore.getSharedAxiosInstance().interceptors.request.use(config => {
    // Add custom headers or modify request config
    return config;
});

// Response Interceptor
webCore.getSharedAxiosInstance().interceptors.response.use(response => {
    // Process response data
    return response;
});
```

### Usage with Builders

The shared Axios instance is automatically used when creating request builders:

```typescript
// Using with regular request builder
const request = webCore.buildRequest({
    method: 'GET',
    baseURL: 'https://api.example.com',
});

// Using with AWS signed request builder
const signedRequest = webCore.buildSignedRequest({
    method: 'GET',
    baseURL: 'https://api.example.com',
});
```

Both builders will use the same shared Axios instance, ensuring that any global configurations or interceptors are consistently applied across all requests.

## Troubleshooting

Please follow this guidelines when reporting bugs and feature requests:

1. Use [GitHub Issues](https://github.com/lemoncloud-io/lemon-web-core/issues) board to report bugs and feature requests (not our email address)
2. Please **always** write steps to reproduce the error. That way we can focus on fixing the bug, not scratching our heads trying to reproduce it.

Thanks for understanding!

## Please Star ⭐️

If this project has been helpful to you, I would greatly appreciate it if you could click the Star⭐️ button on this repository!

## Maintainers

-   [Hyungtak Jin](https://github.com/louis-lemon)
