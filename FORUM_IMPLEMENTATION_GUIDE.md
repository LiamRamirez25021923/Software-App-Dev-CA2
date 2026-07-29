# SavePoint Community Forum Implementation Guide

## What was implemented

The Community Forum is now a working Reddit-style community system inside SavePoint.

Users can:

- search for communities;
- create a community and automatically become its protected Owner;
- join and leave communities;
- create text posts with optional image uploads;
- comment on posts;
- upvote and downvote posts;
- receive notifications when a joined community gets a new post;
- receive notifications when their post is voted on or commented on;
- view and mark forum notifications as read.

Community Owners can:

- create roles;
- choose a role colour and hierarchy position;
- toggle role permissions;
- assign roles to members;
- appoint Co-Owners;
- kick, ban and restore members;
- moderate posts;
- transfer ownership.

The Owner is protected by server-side checks and cannot be kicked, banned or assigned another role.

SavePoint administrators can:

- enter any community's management page;
- manage roles and members;
- restrict a community from accepting new members;
- delete communities;
- transfer ownership.

## RBAC permissions

Roles support these independent Boolean permissions:

- `can_manage_posts`
- `can_manage_members`
- `can_manage_roles`
- `can_create_posts`
- `can_comment`
- `can_vote`

The switches in the management page map directly to these database fields. Permission checks also happen on the server, so hiding a button is not the only protection.

## Main files

- `src/forum/forum.js` — database setup, routes, permissions and notification logic
- `views/forum/index.ejs` — community search and discovery
- `views/forum/community.ejs` — community feed and post creation
- `views/forum/post.ejs` — post, votes and comments
- `views/forum/manage.ejs` — roles, permissions and member management
- `views/forum/notifications.ejs` — notification inbox
- `public/css/styles.css` — SavePoint-themed forum styling
- `database/schema.sql` — forum database schema reference

## Database tables

- `communities`
- `community_roles`
- `community_members`
- `forum_posts` (extended with `community_id`, `image_url`, and `updated_at`)
- `forum_comments`
- `forum_votes`
- `forum_notifications`

The app creates or updates these automatically during startup.

## Test plan

1. Run `npm install` and `node app.js`.
2. Log in as a regular user.
3. Open `/forum` and create a community.
4. Open the community and create a post.
5. Log in with another user and join the community.
6. Vote and comment on the post.
7. Log back into the post author's account and check Forum Notifications.
8. Open the community management page as its Owner.
9. Create a role, toggle permissions and assign it to the second user.
10. Confirm the Owner cannot be kicked, banned or demoted.
11. Log in as SavePoint admin and test restriction, ownership transfer and community removal.

## Presentation explanation

The feature uses Role-Based Access Control. Instead of checking only whether someone is an Owner or ordinary user, each community role stores permission flags in MySQL. Every protected route loads the user's membership and role, then checks the required permission before changing data. The Owner receives an immutable authority path that overrides ordinary roles, preventing other members from removing or demoting the Owner.
