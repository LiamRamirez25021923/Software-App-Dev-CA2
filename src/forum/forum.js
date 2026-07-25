const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const PERMISSION_FIELDS = [
    'can_manage_posts',
    'can_manage_members',
    'can_manage_roles',
    'can_create_posts',
    'can_comment',
    'can_vote'
];


function getYouTubeEmbedUrl(value) {
    const text = String(value || '');

    // Supports standard watch links, youtu.be links, Shorts, Live and embed URLs.
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^#\s]*&)?v=([A-Za-z0-9_-]{11})/i,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return `https://www.youtube-nocookie.com/embed/${match[1]}`;
        }
    }

    return null;
}

function createForumFeature({ pool, requireLogin, requireAdmin, projectRoot, saveMediaAsset }) {
    const router = express.Router();

    // Make the safe YouTube URL parser available to every forum EJS template.
    router.use((req, res, next) => {
        res.locals.getYouTubeEmbedUrl = getYouTubeEmbedUrl;
        next();
    });
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 8 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
                return cb(new Error('Forum uploads must be image or video files.'));
            }
            cb(null, true);
        }
    });

    async function ensureForumStorage() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS communities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                slug VARCHAR(120) NOT NULL UNIQUE,
                description TEXT NULL,
                owner_user_id INT NOT NULL,
                status ENUM('active','restricted','removed') NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS community_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_id INT NOT NULL,
                name VARCHAR(80) NOT NULL,
                role_color VARCHAR(20) NOT NULL DEFAULT '#5ce1e6',
                position INT NOT NULL DEFAULT 0,
                is_co_owner BOOLEAN NOT NULL DEFAULT FALSE,
                can_manage_posts BOOLEAN NOT NULL DEFAULT FALSE,
                can_manage_members BOOLEAN NOT NULL DEFAULT FALSE,
                can_manage_roles BOOLEAN NOT NULL DEFAULT FALSE,
                can_create_posts BOOLEAN NOT NULL DEFAULT TRUE,
                can_comment BOOLEAN NOT NULL DEFAULT TRUE,
                can_vote BOOLEAN NOT NULL DEFAULT TRUE,
                created_by_user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_role_name (community_id, name)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS community_members (
                community_id INT NOT NULL,
                user_id INT NOT NULL,
                role_id INT NULL,
                membership_status ENUM('active','kicked','banned') NOT NULL DEFAULT 'active',
                notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (community_id, user_id)
            )
        `);

        const [postColumns] = await pool.query('SHOW COLUMNS FROM forum_posts');
        const postColumnNames = new Set(postColumns.map((column) => column.Field));
        const additions = [
            ['community_id', 'INT NULL'],
            ['image_url', 'VARCHAR(255) NULL'],
            ['video_url', 'VARCHAR(255) NULL'],
            ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
        ];
        for (const [column, definition] of additions) {
            if (!postColumnNames.has(column)) {
                await pool.query(`ALTER TABLE forum_posts ADD COLUMN \`${column}\` ${definition}`);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS forum_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                author_user_id INT NOT NULL,
                body TEXT NOT NULL,
                status ENUM('visible','removed') NOT NULL DEFAULT 'visible',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS forum_votes (
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                vote_value TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, user_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS forum_comment_votes (
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                vote_value TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS forum_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                message VARCHAR(255) NOT NULL,
                link VARCHAR(255) NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [[communityCount]] = await pool.query('SELECT COUNT(*) AS total FROM communities');
        if (Number(communityCount.total) === 0) {
            const [[admin]] = await pool.execute(
                "SELECT id FROM users WHERE username='SavePoint' LIMIT 1"
            );
            if (admin) {
                const [result] = await pool.execute(
                    `INSERT INTO communities (name, slug, description, owner_user_id)
                     VALUES (?, ?, ?, ?)`,
                    [
                        'Retro Lounge',
                        'retro-lounge',
                        'The general SavePoint community for retro games, hardware, collecting and preservation.',
                        admin.id
                    ]
                );
                await createDefaultRoles(result.insertId, admin.id);
                await pool.execute(
                    `INSERT INTO community_members (community_id, user_id, role_id)
                     VALUES (?, ?, NULL)`,
                    [result.insertId, admin.id]
                );
                await pool.execute(
                    `UPDATE forum_posts
                     SET community_id=?
                     WHERE community_id IS NULL`,
                    [result.insertId]
                );
            }
        }
    }

    async function createDefaultRoles(communityId, ownerId) {
        await pool.execute(
            `INSERT IGNORE INTO community_roles
             (community_id, name, role_color, position, is_co_owner,
              can_manage_posts, can_manage_members, can_manage_roles,
              can_create_posts, can_comment, can_vote, created_by_user_id)
             VALUES
             (?, 'Co-Owner', '#ff5da2', 100, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, ?),
             (?, 'Moderator', '#ffd166', 50, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, ?),
             (?, 'Member', '#5ce1e6', 10, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, ?)`,
            [communityId, ownerId, communityId, ownerId, communityId, ownerId]
        );
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 100);
    }

    async function getCommunityBySlug(slug) {
        const [rows] = await pool.execute(
            `SELECT c.*, u.username AS owner_username,
                    (SELECT COUNT(*) FROM community_members cm
                     WHERE cm.community_id=c.id AND cm.membership_status='active') AS member_count,
                    (SELECT COUNT(*) FROM forum_posts fp
                     WHERE fp.community_id=c.id AND fp.status='visible') AS post_count
             FROM communities c
             JOIN users u ON u.id=c.owner_user_id
             WHERE c.slug=? AND c.status!='removed'
             LIMIT 1`,
            [slug]
        );
        return rows[0] || null;
    }

    async function getAccess(user, communityId) {
        if (!user) return { isMember: false, isOwner: false, isAdmin: false };
        if (user.role === 'admin') {
            return {
                isMember: true,
                isOwner: false,
                isAdmin: true,
                isCoOwner: true,
                can_manage_posts: true,
                can_manage_members: true,
                can_manage_roles: true,
                can_create_posts: true,
                can_comment: true,
                can_vote: true
            };
        }

        const [rows] = await pool.execute(
            `SELECT c.owner_user_id, cm.membership_status, cm.notifications_enabled,
                    r.id AS role_id, r.name AS role_name, r.role_color,
                    r.is_co_owner, r.can_manage_posts, r.can_manage_members,
                    r.can_manage_roles, r.can_create_posts, r.can_comment, r.can_vote
             FROM communities c
             LEFT JOIN community_members cm
               ON cm.community_id=c.id AND cm.user_id=?
             LEFT JOIN community_roles r ON r.id=cm.role_id
             WHERE c.id=? LIMIT 1`,
            [user.id, communityId]
        );
        if (!rows.length) return { isMember: false, isOwner: false, isAdmin: false };
        const row = rows[0];
        const isOwner = Number(row.owner_user_id) === Number(user.id);
        const isMember = isOwner || row.membership_status === 'active';
        if (isOwner) {
            return {
                isMember: true,
                isOwner: true,
                isAdmin: false,
                isCoOwner: true,
                can_manage_posts: true,
                can_manage_members: true,
                can_manage_roles: true,
                can_create_posts: true,
                can_comment: true,
                can_vote: true,
                role_name: 'Owner',
                role_color: '#ff5da2'
            };
        }
        return {
            ...row,
            isMember,
            isOwner: false,
            isAdmin: false,
            isCoOwner: Boolean(row.is_co_owner),
            can_manage_posts: Boolean(row.can_manage_posts),
            can_manage_members: Boolean(row.can_manage_members),
            can_manage_roles: Boolean(row.can_manage_roles),
            can_create_posts: Boolean(row.can_create_posts),
            can_comment: Boolean(row.can_comment),
            can_vote: Boolean(row.can_vote)
        };
    }

    async function notifyUser(userId, type, message, link) {
        await pool.execute(
            `INSERT INTO forum_notifications
             (user_id, notification_type, message, link)
             VALUES (?, ?, ?, ?)`,
            [userId, type, message.slice(0, 255), link]
        );
    }

    async function notifyCommunityMembers(communityId, excludedUserId, message, link) {
        const [members] = await pool.execute(
            `SELECT user_id FROM community_members
             WHERE community_id=? AND membership_status='active'
               AND notifications_enabled=TRUE AND user_id<>?`,
            [communityId, excludedUserId]
        );
        await Promise.all(members.map((member) =>
            notifyUser(member.user_id, 'new_post', message, link)
        ));
    }

    router.get('/forum', requireLogin, async (req, res, next) => {
        try {
            const search = String(req.query.search || '').trim();
            const like = `%${search}%`;
            const [communities] = await pool.execute(
                `SELECT c.*, u.username AS owner_username,
                        COUNT(DISTINCT cm.user_id) AS member_count,
                        COUNT(DISTINCT fp.id) AS post_count,
                        MAX(CASE WHEN current_member.user_id IS NOT NULL
                                 AND current_member.membership_status='active'
                                 THEN 1 ELSE 0 END) AS is_joined
                 FROM communities c
                 JOIN users u ON u.id=c.owner_user_id
                 LEFT JOIN community_members cm
                   ON cm.community_id=c.id AND cm.membership_status='active'
                 LEFT JOIN forum_posts fp
                   ON fp.community_id=c.id AND fp.status='visible'
                 LEFT JOIN community_members current_member
                   ON current_member.community_id=c.id AND current_member.user_id=?
                 WHERE c.status!='removed'
                   AND (?='' OR c.name LIKE ? OR c.description LIKE ?)
                 GROUP BY c.id
                 ORDER BY is_joined DESC, member_count DESC, c.created_at DESC`,
                [req.session.user.id, search, like, like]
            );

            const [recentPosts] = await pool.execute(
                `SELECT fp.id, fp.title, fp.body, fp.created_at,
                        c.name AS community_name, c.slug AS community_slug,
                        u.username AS author_username, u.id AS author_user_id,
                        u.profile_image AS author_profile_image,
                        COALESCE((
                            SELECT SUM(fv.vote_value)
                            FROM forum_votes fv
                            WHERE fv.post_id=fp.id
                        ), 0) AS score,
                        (
                            SELECT COUNT(*)
                            FROM forum_comments fc
                            WHERE fc.post_id=fp.id AND fc.status='visible'
                        ) AS comment_count
                 FROM forum_posts fp
                 JOIN communities c ON c.id=fp.community_id
                 JOIN users u ON u.id=fp.author_user_id
                 WHERE fp.status='visible' AND c.status!='removed'
                 ORDER BY fp.created_at DESC
                 LIMIT 10`
            );

            const [[notificationCount]] = await pool.execute(
                `SELECT COUNT(*) AS total FROM forum_notifications
                 WHERE user_id=? AND is_read=FALSE`,
                [req.session.user.id]
            );

            res.render('forum/index', {
                title: 'Community Forum',
                communities,
                recentPosts,
                search,
                unreadNotifications: Number(notificationCount.total),
                message: req.session.forumMessage || null
            });
            delete req.session.forumMessage;
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/communities', requireLogin, async (req, res, next) => {
        try {
            const name = String(req.body.name || '').trim();
            const description = String(req.body.description || '').trim();
            const slug = slugify(name);
            if (name.length < 3 || !slug) {
                return res.status(400).render('error', {
                    title: 'Invalid community',
                    message: 'Community names must contain at least 3 characters.'
                });
            }
            const [result] = await pool.execute(
                `INSERT INTO communities (name, slug, description, owner_user_id)
                 VALUES (?, ?, ?, ?)`,
                [name, slug, description || null, req.session.user.id]
            );
            await createDefaultRoles(result.insertId, req.session.user.id);
            await pool.execute(
                `INSERT INTO community_members (community_id, user_id, role_id)
                 VALUES (?, ?, NULL)`,
                [result.insertId, req.session.user.id]
            );
            res.redirect(`/forum/communities/${slug}`);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).render('error', {
                    title: 'Community already exists',
                    message: 'Choose a different community name.'
                });
            }
            next(error);
        }
    });

    router.get('/forum/communities/:slug', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) {
                return res.status(404).render('error', {
                    title: 'Community not found',
                    message: 'That community does not exist or has been removed.'
                });
            }
            const access = await getAccess(req.session.user, community.id);
            const [posts] = await pool.execute(
                `SELECT fp.*, u.username AS author_username, u.id AS author_user_id,
                        u.profile_image AS author_profile_image,
                        COALESCE((
                            SELECT SUM(fv.vote_value)
                            FROM forum_votes fv
                            WHERE fv.post_id=fp.id
                        ), 0) AS score,
                        (
                            SELECT COUNT(*)
                            FROM forum_comments fc
                            WHERE fc.post_id=fp.id AND fc.status='visible'
                        ) AS comment_count,
                        COALESCE((
                            SELECT fv.vote_value
                            FROM forum_votes fv
                            WHERE fv.post_id=fp.id AND fv.user_id=?
                            LIMIT 1
                        ), 0) AS current_vote
                 FROM forum_posts fp
                 JOIN users u ON u.id=fp.author_user_id
                 WHERE fp.community_id=? AND fp.status='visible'
                 ORDER BY fp.created_at DESC`,
                [req.session.user.id, community.id]
            );
            res.render('forum/community', {
                title: community.name,
                community,
                posts,
                access,
                message: req.session.forumMessage || null
            });
            delete req.session.forumMessage;
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/communities/:slug/join', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            if (community.status === 'restricted' && req.session.user.role !== 'admin') {
                return res.status(403).render('error', {
                    title: 'Community restricted',
                    message: 'A SavePoint administrator has temporarily disabled new members for this community.'
                });
            }
            const [existing] = await pool.execute(
                `SELECT membership_status FROM community_members
                 WHERE community_id=? AND user_id=? LIMIT 1`,
                [community.id, req.session.user.id]
            );
            if (existing[0]?.membership_status === 'banned') {
                return res.status(403).render('error', {
                    title: 'Community access denied',
                    message: 'You are banned from this community.'
                });
            }
            const [memberRole] = await pool.execute(
                `SELECT id FROM community_roles
                 WHERE community_id=? AND name='Member' LIMIT 1`,
                [community.id]
            );
            await pool.execute(
                `INSERT INTO community_members
                 (community_id, user_id, role_id, membership_status)
                 VALUES (?, ?, ?, 'active')
                 ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), membership_status='active'`,
                [community.id, req.session.user.id, memberRole[0]?.id || null]
            );
            req.session.forumMessage = `You joined ${community.name}.`;
            res.redirect(`/forum/communities/${community.slug}`);
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/communities/:slug/leave', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            if (Number(community.owner_user_id) === Number(req.session.user.id)) {
                return res.status(403).render('error', {
                    title: 'Owner cannot leave',
                    message: 'Transfer ownership before leaving this community.'
                });
            }
            await pool.execute(
                `DELETE FROM community_members WHERE community_id=? AND user_id=?`,
                [community.id, req.session.user.id]
            );
            res.redirect('/forum');
        } catch (error) {
            next(error);
        }
    });

    router.post(
        '/forum/communities/:slug/posts',
        requireLogin,
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        async (req, res, next) => {
            try {
                const community = await getCommunityBySlug(req.params.slug);
                if (!community) return res.redirect('/forum');
                const access = await getAccess(req.session.user, community.id);
                if (!access.isMember || !access.can_create_posts) {
                    return res.status(403).render('error', {
                        title: 'Posting denied',
                        message: 'Join this community and obtain posting permission first.'
                    });
                }
                const title = String(req.body.title || '').trim();
                const body = String(req.body.body || '').trim();
                if (title.length < 3 || body.length < 1) {
                    return res.status(400).render('error', {
                        title: 'Invalid post',
                        message: 'Posts need a title and body.'
                    });
                }
                const imageFile = req.files?.image?.[0] || null;
                const videoFile = req.files?.video?.[0] || null;
                const imageUrl = imageFile
                    ? await saveMediaAsset(imageFile, req.session.user.id, 'image')
                    : null;
                const videoUrl = videoFile
                    ? await saveMediaAsset(videoFile, req.session.user.id, 'video')
                    : null;

                const [result] = await pool.execute(
                    `INSERT INTO forum_posts
                     (community_id, author_user_id, title, body, image_url, video_url, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'visible')`,
                    [community.id, req.session.user.id, title, body, imageUrl, videoUrl]
                );
                await notifyCommunityMembers(
                    community.id,
                    req.session.user.id,
                    `${req.session.user.username} posted in ${community.name}: ${title}`,
                    `/forum/posts/${result.insertId}`
                );
                res.redirect(`/forum/posts/${result.insertId}`);
            } catch (error) {
                next(error);
            }
        }
    );

    router.get('/forum/posts/:id', requireLogin, async (req, res, next) => {
        try {
            const postId = Number(req.params.id);
            const [posts] = await pool.execute(
                `SELECT fp.*, c.name AS community_name, c.slug AS community_slug,
                        c.owner_user_id, u.username AS author_username,
                        u.id AS author_user_id, u.profile_image AS author_profile_image,
                        COALESCE(SUM(fv.vote_value),0) AS score,
                        MAX(CASE WHEN fv.user_id=? THEN fv.vote_value ELSE 0 END) AS current_vote
                 FROM forum_posts fp
                 JOIN communities c ON c.id=fp.community_id
                 JOIN users u ON u.id=fp.author_user_id
                 LEFT JOIN forum_votes fv ON fv.post_id=fp.id
                 WHERE fp.id=? AND fp.status='visible' AND c.status!='removed'
                 GROUP BY fp.id LIMIT 1`,
                [req.session.user.id, postId]
            );
            if (!posts.length) {
                return res.status(404).render('error', {
                    title: 'Post not found',
                    message: 'That post was removed or does not exist.'
                });
            }
            const post = posts[0];
            const access = await getAccess(req.session.user, post.community_id);
            const [comments] = await pool.execute(
                `SELECT fc.*, u.username AS author_username,
                        u.id AS author_user_id, u.profile_image AS author_profile_image,
                        COALESCE(SUM(cv.vote_value), 0) AS score,
                        MAX(CASE WHEN cv.user_id=? THEN cv.vote_value ELSE 0 END) AS current_vote
                 FROM forum_comments fc
                 JOIN users u ON u.id=fc.author_user_id
                 LEFT JOIN forum_comment_votes cv ON cv.comment_id=fc.id
                 WHERE fc.post_id=? AND fc.status='visible'
                 GROUP BY fc.id
                 ORDER BY fc.created_at ASC`,
                [req.session.user.id, postId]
            );
            res.render('forum/post', { title: post.title, post, comments, access });
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/posts/:id/vote', requireLogin, async (req, res, next) => {
        try {
            const postId = Number(req.params.id);
            const vote = Number(req.body.vote);
            if (![1, -1, 0].includes(vote)) return res.status(400).send('Invalid vote');
            const [posts] = await pool.execute(
                `SELECT fp.author_user_id, fp.title, fp.community_id
                 FROM forum_posts fp WHERE fp.id=? AND fp.status='visible' LIMIT 1`,
                [postId]
            );
            if (!posts.length) return res.status(404).send('Post not found');
            const access = await getAccess(req.session.user, posts[0].community_id);
            if (!access.isMember || !access.can_vote) return res.status(403).send('Voting denied');
            const [existingVotes] = await pool.execute(
                `SELECT vote_value
                 FROM forum_votes
                 WHERE post_id=? AND user_id=?
                 LIMIT 1`,
                [postId, req.session.user.id]
            );

            const previousVote = existingVotes.length
                ? Number(existingVotes[0].vote_value)
                : 0;

            // Each button press changes the displayed score by exactly one.
            // When changing direction, the first press clears the opposite vote;
            // a second press applies the new vote. This prevents -1 -> +1 from
            // jumping the score by two points in a single click.
            if (vote === 0 || previousVote === vote || previousVote === -vote) {
                await pool.execute(
                    'DELETE FROM forum_votes WHERE post_id=? AND user_id=?',
                    [postId, req.session.user.id]
                );
            } else {
                await pool.execute(
                    `INSERT INTO forum_votes (post_id, user_id, vote_value)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                         vote_value=?,
                         updated_at=CURRENT_TIMESTAMP`,
                    [postId, req.session.user.id, vote, vote]
                );

                if (Number(posts[0].author_user_id) !== Number(req.session.user.id)) {
                    await notifyUser(
                        posts[0].author_user_id,
                        vote === 1 ? 'upvote' : 'downvote',
                        `${req.session.user.username} ${vote === 1 ? 'liked' : 'disliked'} your post: ${posts[0].title}`,
                        `/forum/posts/${postId}`
                    );
                }
            }
            res.redirect(req.get('referer') || `/forum/posts/${postId}`);
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/posts/:id/comments', requireLogin, async (req, res, next) => {
        try {
            const postId = Number(req.params.id);
            const body = String(req.body.body || '').trim();
            const [posts] = await pool.execute(
                `SELECT author_user_id, title, community_id FROM forum_posts
                 WHERE id=? AND status='visible' LIMIT 1`,
                [postId]
            );
            if (!posts.length) return res.redirect('/forum');
            const access = await getAccess(req.session.user, posts[0].community_id);
            if (!access.isMember || !access.can_comment) {
                return res.status(403).render('error', {
                    title: 'Commenting denied',
                    message: 'You do not have permission to comment in this community.'
                });
            }
            if (!body) return res.redirect(`/forum/posts/${postId}`);
            await pool.execute(
                `INSERT INTO forum_comments (post_id, author_user_id, body)
                 VALUES (?, ?, ?)`,
                [postId, req.session.user.id, body]
            );
            if (Number(posts[0].author_user_id) !== Number(req.session.user.id)) {
                await notifyUser(
                    posts[0].author_user_id,
                    'comment',
                    `${req.session.user.username} commented on your post: ${posts[0].title}`,
                    `/forum/posts/${postId}`
                );
            }
            res.redirect(`/forum/posts/${postId}`);
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/comments/:id/vote', requireLogin, async (req, res, next) => {
        try {
            const commentId = Number(req.params.id);
            const vote = Number(req.body.vote);
            if (!Number.isInteger(commentId) || ![1, -1].includes(vote)) {
                return res.status(400).send('Invalid comment vote');
            }

            const [comments] = await pool.execute(
                `SELECT fc.id, fc.author_user_id, fp.id AS post_id, fp.community_id
                 FROM forum_comments fc
                 JOIN forum_posts fp ON fp.id=fc.post_id
                 WHERE fc.id=? AND fc.status='visible' AND fp.status='visible'
                 LIMIT 1`,
                [commentId]
            );
            if (!comments.length) return res.status(404).send('Comment not found');

            const access = await getAccess(req.session.user, comments[0].community_id);
            if (!access.isMember || !access.can_vote) return res.status(403).send('Voting denied');

            const [existing] = await pool.execute(
                `SELECT vote_value FROM forum_comment_votes
                 WHERE comment_id=? AND user_id=? LIMIT 1`,
                [commentId, req.session.user.id]
            );
            const previous = existing.length ? Number(existing[0].vote_value) : 0;

            // Keep comment voting consistent with post voting: one click
            // changes the score by one. An opposite vote is cleared first.
            if (previous === vote || previous === -vote) {
                await pool.execute(
                    'DELETE FROM forum_comment_votes WHERE comment_id=? AND user_id=?',
                    [commentId, req.session.user.id]
                );
            } else {
                await pool.execute(
                    `INSERT INTO forum_comment_votes (comment_id, user_id, vote_value)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE vote_value=?, updated_at=CURRENT_TIMESTAMP`,
                    [commentId, req.session.user.id, vote, vote]
                );
            }

            return res.redirect(req.get('referer') || `/forum/posts/${comments[0].post_id}`);
        } catch (error) {
            return next(error);
        }
    });

    router.post('/forum/posts/:id/delete', requireLogin, async (req, res, next) => {
        try {
            const postId = Number(req.params.id);
            const [posts] = await pool.execute(
                `SELECT community_id, author_user_id FROM forum_posts
                 WHERE id=? LIMIT 1`,
                [postId]
            );
            if (!posts.length) return res.redirect('/forum');
            const access = await getAccess(req.session.user, posts[0].community_id);
            const ownsPost = Number(posts[0].author_user_id) === Number(req.session.user.id);
            if (!ownsPost && !access.can_manage_posts) {
                return res.status(403).render('error', {
                    title: 'Delete denied',
                    message: 'You cannot delete this post.'
                });
            }
            await pool.execute("UPDATE forum_posts SET status='removed' WHERE id=?", [postId]);
            const [[community]] = await pool.execute('SELECT slug FROM communities WHERE id=?', [posts[0].community_id]);
            res.redirect(community ? `/forum/communities/${community.slug}` : '/forum');
        } catch (error) {
            next(error);
        }
    });

    router.get('/forum/notifications', requireLogin, async (req, res, next) => {
        try {
            const [notifications] = await pool.execute(
                `SELECT * FROM forum_notifications
                 WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,
                [req.session.user.id]
            );
            res.render('forum/notifications', { title: 'Forum Notifications', notifications });
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/notifications/read-all', requireLogin, async (req, res, next) => {
        try {
            await pool.execute(
                'UPDATE forum_notifications SET is_read=TRUE WHERE user_id=?',
                [req.session.user.id]
            );
            res.redirect('/forum/notifications');
        } catch (error) {
            next(error);
        }
    });

    router.get('/forum/communities/:slug/manage', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            const access = await getAccess(req.session.user, community.id);
            if (!access.isOwner && !access.isAdmin && !access.can_manage_members && !access.can_manage_roles) {
                return res.status(403).render('error', {
                    title: 'Management denied',
                    message: 'Your community role does not permit management.'
                });
            }
            const [roles] = await pool.execute(
                `SELECT * FROM community_roles WHERE community_id=?
                 ORDER BY position DESC, name`,
                [community.id]
            );
            const [members] = await pool.execute(
                `SELECT cm.*, u.username, r.name AS role_name, r.role_color,
                        CASE WHEN u.id=c.owner_user_id THEN 1 ELSE 0 END AS is_owner
                 FROM community_members cm
                 JOIN users u ON u.id=cm.user_id
                 JOIN communities c ON c.id=cm.community_id
                 LEFT JOIN community_roles r ON r.id=cm.role_id
                 WHERE cm.community_id=?
                 ORDER BY is_owner DESC, cm.membership_status, u.username`,
                [community.id]
            );
            res.render('forum/manage', { title: `Manage ${community.name}`, community, access, roles, members, permissionFields: PERMISSION_FIELDS });
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/communities/:slug/roles', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            const access = await getAccess(req.session.user, community.id);
            if (!access.isOwner && !access.isAdmin && !access.isCoOwner && !access.can_manage_roles) {
                return res.status(403).render('error', { title: 'Role creation denied', message: 'You cannot manage roles.' });
            }
            const name = String(req.body.name || '').trim();
            if (!name) return res.redirect(`/forum/communities/${community.slug}/manage`);
            const values = PERMISSION_FIELDS.map((field) => req.body[field] === 'on' ? 1 : 0);
            const isCoOwner = req.body.is_co_owner === 'on' && (access.isOwner || access.isAdmin);
            await pool.execute(
                `INSERT INTO community_roles
                 (community_id, name, role_color, position, is_co_owner,
                  can_manage_posts, can_manage_members, can_manage_roles,
                  can_create_posts, can_comment, can_vote, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    community.id,
                    name,
                    String(req.body.role_color || '#5ce1e6'),
                    Number.parseInt(req.body.position, 10) || 0,
                    isCoOwner ? 1 : 0,
                    ...values,
                    req.session.user.id
                ]
            );
            res.redirect(`/forum/communities/${community.slug}/manage`);
        } catch (error) {
            next(error);
        }
    });

    router.post('/forum/communities/:slug/members/:userId/role', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            const access = await getAccess(req.session.user, community.id);
            if (!access.isOwner && !access.isAdmin && !access.isCoOwner && !access.can_manage_roles) {
                return res.status(403).render('error', { title: 'Role assignment denied', message: 'You cannot assign roles.' });
            }
            const targetUserId = Number(req.params.userId);
            if (targetUserId === Number(community.owner_user_id)) {
                return res.status(403).render('error', { title: 'Owner protected', message: 'The community owner role cannot be changed.' });
            }
            const roleId = Number(req.body.role_id) || null;
            if (roleId) {
                const [roles] = await pool.execute('SELECT id, is_co_owner FROM community_roles WHERE id=? AND community_id=?', [roleId, community.id]);
                if (!roles.length) return res.status(400).send('Invalid role');
                if (roles[0].is_co_owner && !access.isOwner && !access.isAdmin) {
                    return res.status(403).render('error', { title: 'Role assignment denied', message: 'Only the owner or a SavePoint admin can appoint a Co-Owner.' });
                }
            }
            await pool.execute(
                `UPDATE community_members SET role_id=?
                 WHERE community_id=? AND user_id=?`,
                [roleId, community.id, targetUserId]
            );
            res.redirect(`/forum/communities/${community.slug}/manage`);
        } catch (error) {
            next(error);
        }
    });

    async function moderateMember(req, res, next, status) {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            const access = await getAccess(req.session.user, community.id);
            if (!access.isOwner && !access.isAdmin && !access.can_manage_members) {
                return res.status(403).render('error', { title: 'Member management denied', message: 'You cannot manage members.' });
            }
            const targetUserId = Number(req.params.userId);
            if (targetUserId === Number(community.owner_user_id)) {
                return res.status(403).render('error', { title: 'Owner protected', message: 'The community owner cannot be kicked or banned.' });
            }
            await pool.execute(
                `UPDATE community_members SET membership_status=?
                 WHERE community_id=? AND user_id=?`,
                [status, community.id, targetUserId]
            );
            res.redirect(`/forum/communities/${community.slug}/manage`);
        } catch (error) {
            next(error);
        }
    }

    router.post('/forum/communities/:slug/members/:userId/kick', requireLogin, (req, res, next) => moderateMember(req, res, next, 'kicked'));
    router.post('/forum/communities/:slug/members/:userId/ban', requireLogin, (req, res, next) => moderateMember(req, res, next, 'banned'));
    router.post('/forum/communities/:slug/members/:userId/restore', requireLogin, (req, res, next) => moderateMember(req, res, next, 'active'));

    router.post('/forum/communities/:slug/transfer', requireLogin, async (req, res, next) => {
        try {
            const community = await getCommunityBySlug(req.params.slug);
            if (!community) return res.redirect('/forum');
            const access = await getAccess(req.session.user, community.id);
            if (!access.isOwner && !access.isAdmin) {
                return res.status(403).render('error', { title: 'Transfer denied', message: 'Only the owner or SavePoint admin can transfer ownership.' });
            }
            const targetUserId = Number(req.body.user_id);
            const [members] = await pool.execute(
                `SELECT user_id FROM community_members
                 WHERE community_id=? AND user_id=? AND membership_status='active' LIMIT 1`,
                [community.id, targetUserId]
            );
            if (!members.length) {
                return res.status(400).render('error', { title: 'Transfer failed', message: 'Ownership can only be transferred to an active community member.' });
            }
            await pool.execute('UPDATE communities SET owner_user_id=? WHERE id=?', [targetUserId, community.id]);
            res.redirect(`/forum/communities/${community.slug}/manage`);
        } catch (error) {
            next(error);
        }
    });

    router.post('/admin/forum/communities/:id/restrict', requireAdmin, async (req, res, next) => {
        try {
            const communityId = Number(req.params.id);
            const status = req.body.status === 'restricted' ? 'restricted' : 'active';
            await pool.execute('UPDATE communities SET status=? WHERE id=?', [status, communityId]);
            const [[community]] = await pool.execute('SELECT slug FROM communities WHERE id=?', [communityId]);
            res.redirect(community ? `/forum/communities/${community.slug}/manage` : '/forum');
        } catch (error) {
            next(error);
        }
    });

    router.post('/admin/forum/communities/:id/delete', requireAdmin, async (req, res, next) => {
        try {
            await pool.execute("UPDATE communities SET status='removed' WHERE id=?", [Number(req.params.id)]);
            res.redirect('/forum');
        } catch (error) {
            next(error);
        }
    });

    return { router, ensureForumStorage };
}

module.exports = createForumFeature;
