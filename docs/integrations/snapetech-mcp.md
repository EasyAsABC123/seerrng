# SnapeTech MCP

This guide documents the Snapetech-maintained SeerrNG fork's API integration.
References to Seerr and Overseerr below describe upstream products or public
MCP examples, not the authorship of this guide.

SeerrNG does not run an MCP server inside the application. The shared
`snapetech-mcp` process connects to this instance over its existing HTTP API
using MCP stdio transport. Its quickstart is in the sibling
`snapetech-mcp/README.md`.

## Tools and API access

| MCP tool | SeerrNG endpoint | Result |
| --- | --- | --- |
| `seerrng_status` | `GET /api/v1/status` | Reachability only. |
| `seerrng_search_media` | `GET /api/v1/search` | Up to ten projected results per page; accepts a bounded page and optional media-type filter. |

Configure `SNAPETECH_MCP_APPS=seerrng`,
`SNAPETECH_MCP_SEERRNG_URL=<SeerrNG base URL>`, and
`SNAPETECH_MCP_SEERRNG_API_KEY=<current SeerrNG API key>` in the MCP host's protected
environment. The server sends the key in `X-Api-Key`; do not put it in a URL.
The base URL is the application origin, without `/api`.

## Credential and data boundaries

SeerrNG has one configured API key, which authenticates with the owner
account's service-level authority; it does not currently provide a separate
per-integration or catalog-search-only key. The MCP tool only sends GET
requests and returns a small projection, but the API credential itself can do
more if used outside this bridge. Restrict access to the local MCP process and
rotate the key if exposed, after updating any other clients that use it.

Search terms are sent to the metadata and media providers configured in
SeerrNG. Do not send queries through the MCP tool if they must remain local.
The result projection omits settings, user data, paths, and provider
credentials.

Keep the MCP process attached to a trusted local client. Prefer HTTPS for a
remote SeerrNG instance; HTTP is accepted automatically only for loopback.
Never expose the stdio server through a TCP bridge or reverse proxy.

## Competitor feature coverage

The Seerr/Overseerr product family covers media discovery, library availability, movie
and season requests, approval workflows, user permissions and limits, server
integrations, and notifications. SeerrNG extends that workflow across additional media
categories, including books, music, comics, magazines, ROMs, and PC games. See the
[upstream Seerr feature overview](https://seerr.dev/) and SeerrNG's [feature guide](../using-seerr/software-acquisition.md).

Snapetech MCP exposes status and page-bounded provider-backed search. Request and user
summaries remain unavailable because the current credential authenticates with broad
owner-level authority. Request creation, approval, retry, and deletion remain separate
write-capability work. Public
examples include a [read plus guarded-request Seerr MCP](https://github.com/cyanheads/seerr-mcp-server) and a broader [Overseerr MCP](https://github.com/jhomen368/overseerr-mcp); these are feature
references, not security endorsements.

**Confidence:** high for the product-scope summary from primary Seerr/SeerrNG documentation and the broad owner-key boundary in the reviewed source.

Source contract: `server/middleware/auth.ts`, `server/routes/search.ts`, and
`server/routes/index.ts`.
