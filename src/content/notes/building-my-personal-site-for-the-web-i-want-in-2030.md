---
id: 01a036e3-c69a-757c-9c83-6ae1712d24e5
title: Building my personal site for the web I want in 2030
slug: building-my-personal-site-for-the-web-i-want-in-2030
date: 2026-08-25
previousSlugs: []
tags: []
presentation: note
relationships: []
syndication: []
draft: false
privacyReviewed: true
---
# Building my personal site for the web I want in 2030

I have been rebuilding parts of this site around a simple question:

If I were designing a personal website for the web of 2030, what would I want to own?

Not a blockchain wallet. Not a social account. Not a profile inside somebody else’s network.

My answer, increasingly, is this domain.

karthikg.in should be the durable representation of me and the things I publish. Social networks, feeds, search engines and whatever comes after them should be ways of discovering or interacting with that material—not the place where its identity originates.

Some of this site already worked that way. Notes lived here first. RSS was generated from the same content. I could publish a note here and syndicate it to Bluesky. Webmentions gave the site a small connection to the wider independent web.

But there were cracks in the idea. A note’s identity was effectively its filename. Renaming it could change its URL. Projects mostly pointed elsewhere instead of having canonical pages here. My identity was repeated across several templates. Bluesky-specific rules and Webmention plumbing sat close to the content model. Incoming interactions lived with a provider.

So I started separating identity from location.

Every canonical object now has an immutable ID. A note has an identity independent of its slug. Its URL can evolve without changing what the object is. Old slugs can permanently redirect to the current location.

Projects now have first-party pages too. Neighborbook may run somewhere else, but there is a canonical object on karthikg.in describing it. The product URL is a location you can visit; it isn’t the project’s identity.

The site’s public facts now come from one structured Person object rather than being independently encoded in different pages.

The more important change, though, is one you mostly can’t see.

The site’s core no longer needs to know about Bluesky, RSS, Webmentions or microformats. It knows about people, notes, projects, identity and relationships. Protocols sit at the edges and translate those objects into whatever representation another part of the web understands.

RSS is a projection.

Microformats are a projection.

A Bluesky post is a syndicated copy.

A future ActivityPub representation could be another projection.

None of them need to become the source of truth.

There is also now the beginning of something that could eventually become a small personal knowledge graph. But I stopped there. There isn’t enough writing on this site yet to justify building the graph.

It would be easy to add relationship types, backlink indexes, JSON-LD, ActivityPub, agent-readable APIs and a dozen other things that sound like the future web. But architecture built ahead of actual meaning becomes its own kind of dependency.

So the next phase isn’t another protocol.

It’s writing.