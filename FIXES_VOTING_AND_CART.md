# SavePoint voting and cart fixes

## Cart product images

Cart images now support all image formats used by SavePoint:

- database-backed media routes such as `/media/12`
- external `http://` or `https://` URLs
- legacy filenames stored in `public/images`

The previous cart template prepended `/images/` to `/media/...`, producing an invalid path such as `/images//media/12`.

## Forum score calculation

Community-feed scores now use separate subqueries for votes and comments. This prevents a post's vote total from being multiplied by the number of comments when the two tables are joined together.

## Voting behaviour

Each click now changes the score by exactly one point:

- no vote -> upvote: +1
- upvote -> click upvote again: -1 (clears the vote)
- downvote -> click upvote: +1 (clears the downvote)
- no vote -> downvote: -1
- downvote -> click downvote again: +1 (clears the vote)
- upvote -> click downvote: -1 (clears the upvote)

To move directly from an upvote to a downvote, or vice versa, click the opposite arrow twice. The first click returns the user's vote to neutral; the second applies the new direction.

The same rule applies to comment votes.
