# Persistent Cart Update

SavePoint carts are now associated with the logged-in user's database ID.

## Behaviour

- Adding a marketplace item writes or updates `user_cart_items`.
- Decreasing or removing an item updates the same table.
- Logging out destroys only the browser session; cart rows remain in MySQL.
- Logging in reloads the user's cart from MySQL.
- Completing checkout removes the user's saved cart rows in the same transaction.

## Database

Run `database/add_persistent_cart.sql` once against the SavePoint database.
The application also creates the table automatically during startup.
