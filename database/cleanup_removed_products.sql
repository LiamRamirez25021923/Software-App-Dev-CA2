-- One-time cleanup for listings that older versions only soft-deleted.
-- Review the rows first, then run the DELETE if they are safe to remove.
SELECT id, name, status
FROM products
WHERE status = 'removed';

DELETE FROM products
WHERE status = 'removed';
