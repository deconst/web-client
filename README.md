# Deconst Web client

**Extremely WIP. Just a prototype. Not ready for prime-time. Unstable.**

A web-based editor for making it relatively easy for a contributor to add or edit content to a deconst site without using Git. Would probably bundle the contirbutor's changes into a tarball and send to a site coordinator, or maybe even open a PR on the contributor's behalf.

## Concepts

### Changesets

When a contributor starts working on a submission, they create a **changeset**, which is identified by an 8-byte hex string.

## Components

### MongoDB

Stores state about the web client application. Currently the only thing being stored is a collection of changes, which are documents that look like this:

```json
{
  "changesetId": "0123456789abcdef",
  "contentId": "https://github.com/rackerlabs/docs-developer-blog",
  "envelope" : {
    "meta": {},
    "body": ""
  }
}
```

The fields `changesetId` and `contentId` act as a primary key to uniquely identify a change.

### Content Service Proxy

A proxy to an existing (production) deconst content service, but acts as a middleman for any content that has been changed by a contributor.

When a contributor makes a change to a content ID and then requests that content ID within the scope of their changeset, the content service proxy will return a content envelope from MongoDB:

```bash
# The contributor submits an envelope for `my-content` to the changest `abc`
curl -X PUT -d {{ jsonData }}  http://content-proxy/abc/my-content

# The envelope that is returned comes from MongoDB
curl -X GET http://content-proxy/abc/my-content

# An envelope that hasn't been changed will be fetched from the upstream
# deconst content service
# The following two scenarios will both proxy upstream:

# (nonexistent changeset)
curl -X GET http://content-proxy/xyz/existing-content

# (unchanged envelop in existing changset)
curl -X GET http://content-proxy/abc/existing-content
```

### Presenter Manager

When a new changeset is created, a deconst presenter container is started to preview content for that specific changeset. The presenter manager starts new presenter instances that include the changeset segment used by the content service proxy.

When a user creates changeset `abc`, the presenter manager essentially runs the following (abridged) command:

```bash
docker run \
-d \
--name web-client-presenter-abc \
-e CONTENT_SERVICE_URL=http://content-proxy/abc/ \
quay.io/deconst/presenter
```

### Presenter Proxy

Finally, to actually preview content, the presenter proxy uses the first segment of the request URL to determine which presenter instance to proxy to. It rewrites URLs so that a user can click any links shown by the presenter and still preserve the changesetId in the URL.


```bash
# Proxies to http://web-client-presenter-abc/blog and rewrites URLs on the page
# from `/blog/` to `/abc/blog/`.
curl -X GET http://presenter-proxy/abc/blog/
```
