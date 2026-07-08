// Shared in-memory "seen by" tracking — item id → Set of viewer names.
// Kept in its own module so both the request handlers (server.js) and the
// retention job (cleanup.js) mutate the same Map without a circular require.
// Resets on server restart, no DB needed.
module.exports = new Map();
