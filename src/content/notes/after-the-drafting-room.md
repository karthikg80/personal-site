---
id: 01a039a8-12ed-737d-bec1-38ea48bd7fcd
title: "# After the Drafting Room"
slug: after-the-drafting-room
date: 2026-08-25
previousSlugs: []
tags: []
presentation: note
relationships:
  - type: reply-to
    target:
      kind: external
      url: https://karthikg.in/notes/changing-the-drafting-room/
distribution:
  webmentions: true
  bluesky: true
syndication: []
draft: false
privacyReviewed: true
---
# After the Drafting Room

I wired the bit after the Drafting Room.

The last note was about the room: the agent can sit there and poke at the writing, but it doesn’t publish. A draft leaving the room is still a draft.

Then I wanted the rest of it to happen without me babysitting a terminal.

So: I hit Prepare, and the text goes into Git as unpublished. I have to tick a box saying this exact version is okay to enter the public repo. Publish only flips `draft`. That’s the whole mutation.

If Bluesky is down, the note is still on karthikg.in. That felt like the important split.

Copies wait.

At Prepare, Webmentions and Bluesky are both off unless I say so. Nothing fires until Vercel has actually put that commit on production. The Action fetches the live URL, looks for the ObjectId, then talks to the rest of the web. One note, not a scan of the archive.

Bluesky uses a stable key so a retry doesn’t spawn a second post. The URL gets written back into the file, and a second deploy is what puts `u-syndication` on the page.

I keep almost typing “and then it’s done” and it isn’t, quite. There’s a second deployment. Whatever.

The last note already went through this. I think that’s funny. I wrote about not collapsing thinking into a publish button, then I automated the part after the button.

Still not one button. Just fewer steps I will forget.

I don’t know if this is the right amount of machinery for a site with four notes. It is the amount that meant I didn’t have to remember the CLI this time.