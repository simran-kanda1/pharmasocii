# Community plan — completion checklist

All items from the community site completion plan are implemented. Use this to verify in production.

## 1. Categories & feed

| Item | Status | Where |
|------|--------|--------|
| 58 main categories seeded | Done | `src/lib/defaultCommunityCategories.ts` |
| Seed to Firestore if empty | Done | Admin → Community categories → **Seed defaults (if empty)** |
| Display rule (main / main+sub / main+subSub) | Done | `src/lib/communityCategoryDisplay.ts` |
| Feed `filterKeys` filtering + legacy fallback | Done | `CommunityFeed.tsx`, `postMatchesFilterKeys` |
| Expandable sidebar + country picker | Done | `CommunityFilterSidebar.tsx` |
| Compose: CategoryPicker limits | Done | `CategoryPicker.tsx` |
| Publish requires title + ≥1 category | Done | `NewCommunityPost.tsx` |
| Country multi-select (max 5) | Done | `CountryMultiSelect.tsx` |

## 2. Saved posts & comments (IDs only)

| Item | Status | Where |
|------|--------|--------|
| Saved posts = post ID only | Done | `savedPostsCollection/{postId}` |
| Save on feed PostCard | Done | `CommunityFeed.tsx` |
| Save on post detail | Done | `CommunityPostDetail.tsx` |
| Saved comments = commentId + postId only | Done | `savedCommentsCollection` |
| Dashboard Posts + Comments sections | Done | `MemberDashboard.tsx` |
| `?highlight=` scroll + ring | Done | `CommunityPostDetail.tsx` |
| Unavailable when archived | Done | Dashboard + dynamic fetch |

## 3. Spam & archive

| Item | Status | Where |
|------|--------|--------|
| 3 reports → archive content | Done | `onSpamReportCreated` |
| Post archive → cascade comments | Done | `archiveAllCommentsForPost` |
| 3 author strikes → 30d `spam_blocked` | Done | `onSpamReportCreated` |
| After 30d → active, reset active count | Done | `releaseExpiredSpamBlocks` |
| `admin_hold` view-only | Done | Rules + UI |
| No reply-to-reply | Done | UI + `firestore.rules` |
| Comment images 1.5MB | Done | `CommunityPostDetail.tsx` |
| Restricted users blocked on compose | Done | `NewCommunityPost`, `CommunityFeed` |

## 4. Emails

| Email | Status | Trigger |
|-------|--------|---------|
| Account activation | Done | Member doc created + verification mirror |
| Password reset | Done | `MemberForgotPassword` + `mirrorPasswordResetEmail` |
| Spam strike 1 / 2 / 3 | Done | `onSpamReportCreated` |
| Account reactivated | Done | `releaseExpiredSpamBlocks` |
| Admin restore content | Done | `adminRestorePost` / `adminRestoreComment` |
| Account on hold | Done | `adminSetMemberStatus` → `admin_hold` |
| Admin block 30d | Done | `adminSetMemberStatus` → `spam_blocked` |
| Admin re-enable | Done | `adminSetMemberStatus` → `active` |
| Email log + CC testing | Done | `emailLogCollection`, `COMMUNITY_EMAIL_CC_ALL` |

## 5. Admin

| Item | Status | Where |
|------|--------|--------|
| Community tab (posts, members, spam) | Done | `AdminCommunityPanel.tsx` |
| Email log tab | Done | `AdminEmailLogPanel.tsx` |
| Callable admin actions | Done | `functions/index.js` |
| Audit trail for admin actions | Done | `logActivity` in `AdminCommunityPanel` |

## 6. Auth & infra

| Item | Status | Where |
|------|--------|--------|
| Forgot password routes | Done | `/member/forgot-password`, `/forgot-password` |
| Storage rules `admin/settings` | Done | `storage.rules` |
| Firestore rules updated | Done | `firestore.rules` |
| Functions deployed | Done | Firebase project `pharmasocii` |
| Testing doc | Done | `docs/COMMUNITY_TESTING.md` |

## Your manual steps

1. **Admin → Community categories → Seed defaults (if empty)** (one time if config is empty).
2. Set Cloud Functions env: `SMTP_*`, `VERIFICATION_CC_EMAIL`, optional `COMMUNITY_EMAIL_CC_ALL=true`.
3. Deploy/host frontend (`npm run build` + your hosting).
4. Run through `docs/COMMUNITY_TESTING.md` checklist.
