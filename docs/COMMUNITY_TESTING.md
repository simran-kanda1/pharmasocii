# Community site — testing guide

## Firebase Console (backend)

- **postsCollection** — posts with `filterKeys`, categories, `archived`
- **membersCollection** — `accountStatus` (`active` | `spam_blocked` | `admin_hold`), spam counters
- **membersCollection/{uid}/savedPostsCollection** — doc id = post id only (`savedAt`)
- **membersCollection/{uid}/savedCommentsCollection** — doc id = comment id (`postId`, `savedAt`)
- **spamReportsCollection** — one report per user per target
- **emailLogCollection** — mirrored transactional emails (admin **Email log** tab)
- **verificationMirrors** — activation links (admin Overview)
- **config/communityCategories** — category tree

## Cloud Functions env (Google Cloud Console)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...   # app password
SMTP_FROM=...
VERIFICATION_CC_EMAIL=simrankaurkanda42@gmail.com
COMMUNITY_EMAIL_CC_ALL=true   # CC all community emails for QA
```

Deploy:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

## Admin dashboard

1. **Community** — archive/restore posts, hold/block/reactivate members, view spam reports
2. **Community categories** — **Seed defaults (if empty)** or edit tree; **Save to Firestore**
3. **Email log** — verification mirrors + password reset / spam / reactivation copies

## Member flows

1. Register → verify email (mirror in admin + CC if SMTP set)
2. `/member/forgot-password` or `/forgot-password` → reset email + email log mirror
3. Create post (category + title required, optional countries/links/image)
4. Comment, reply (not reply-to-reply), optional comment image
5. Save post/comment — IDs only; archived content disappears from Saved
6. Report spam (logged in, once per item) — emails at strikes 1–3; 30-day block at 3

## External video links

Posts store URLs only; playback uses the host (YouTube/Vimeo). No Pharmasocii storage/bandwidth cost for linked videos.
