// Api contributions, reachable at /dazl-dev/<pluginId>/<route>. The Web Fetch
// contract (Request -> Response) keeps handlers platform-neutral.

export type ApiHandler = (request: Request) => Response | Promise<Response>;

// Identity at runtime; the wrapper supplies contextual typing so plugins author
// with `export default defineApi((request) => Response.json(...))`.
export function defineApi(handler: ApiHandler): ApiHandler {
    return handler;
}
