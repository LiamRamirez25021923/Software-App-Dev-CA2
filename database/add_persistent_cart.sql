-- SavePoint persistent shopping cart
USE `c237_017_team5_savepoint`;

CREATE TABLE IF NOT EXISTS user_cart_items (
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    INDEX idx_cart_user (user_id),
    INDEX idx_cart_product (product_id)
);
