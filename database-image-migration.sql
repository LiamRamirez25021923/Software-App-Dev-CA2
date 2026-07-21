-- Run this once against your existing MySQL database.
-- MEDIUMBLOB supports files up to 16 MB; the app itself limits uploads to 5 MB.

ALTER TABLE products
  ADD COLUMN imageData MEDIUMBLOB NULL,
  ADD COLUMN imageMimeType VARCHAR(100) NULL;
