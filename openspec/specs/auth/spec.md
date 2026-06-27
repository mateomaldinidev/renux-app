# Auth Specification

## Purpose

JWT-based authentication for RENUX. Exactly two pre-seeded users (admin + demo) with identical privileges but multi-tenant data isolation. No registration, no refresh tokens, no password reset.

## Requirements

### Requirement: Login issues a JWT

The system MUST authenticate a user with `username` + `password` and return a signed JWT. Passwords SHALL be verified against a bcryptjs hash stored in the database.

#### Scenario: Valid credentials

- GIVEN a seeded user with username `admin` and a known password
- WHEN `POST /api/auth/login` is called with the correct credentials
- THEN the response status is `200` and the body contains `{ token, expiresAt }`
- AND `expiresAt` is exactly 7 days after issuance

#### Scenario: Invalid credentials

- GIVEN a seeded user exists
- WHEN `POST /api/auth/login` is called with a wrong password
- THEN the response status is `401` and the body contains a descriptive error message
- AND no JWT is issued

#### Scenario: Unknown user

- WHEN `POST /api/auth/login` is called with a username that does not exist
- THEN the response status is `401`
- AND the error message does NOT reveal whether the username exists

### Requirement: JWT carries user identity

The JWT payload MUST contain `userId` and `username`. The token SHALL be signed with `JWT_SECRET` and expire after 7 days.

#### Scenario: Token payload

- GIVEN a valid login response
- WHEN the returned token is decoded
- THEN the payload contains `userId` (number) and `username` (string)
- AND the `exp` claim is set to 7 days from issuance

### Requirement: Auth middleware verifies JWT

All routes except `POST /api/auth/login` MUST require a valid `Authorization: Bearer <token>` header. The middleware SHALL extract the JWT, verify it, and attach `userId` to the request context for multi-tenant filtering.

#### Scenario: Valid token passes

- GIVEN a request with a valid, non-expired JWT
- WHEN the request reaches a protected route
- THEN `userId` is attached to the context and the request proceeds

#### Scenario: Missing token

- WHEN a protected route is called without an `Authorization` header
- THEN the response status is `401`

#### Scenario: Invalid or expired token

- WHEN a protected route is called with a malformed or expired JWT
- THEN the response status is `401`
- AND the error message indicates authentication failure

### Requirement: Identity endpoint returns username

`GET /api/auth/me` MUST return the authenticated user's username, derived from the verified JWT.

#### Scenario: Authenticated identity

- GIVEN a request with a valid JWT
- WHEN `GET /api/auth/me` is called
- THEN the response status is `200` and the body is `{ username }`

### Requirement: Logout is client-side only

`POST /api/auth/logout` SHALL NOT perform server-side token invalidation. The token MUST be discarded by the client.

#### Scenario: Logout response

- WHEN `POST /api/auth/logout` is called with a valid token
- THEN the response status is `200`
- AND the server keeps no logout state — the same token remains technically valid until expiry

### Requirement: Passwords are never stored in plaintext

Passwords MUST be hashed with bcryptjs before storage. The system SHALL NOT log or return password hashes in any response.

#### Scenario: Seeded password storage

- GIVEN the seed script has run
- WHEN the `users` table is inspected
- THEN `password_hash` contains a bcrypt hash, not the raw password

### Requirement: Two seeded users with identical privileges

The system MUST have exactly two users after seeding: `admin` (real business) and `demo` (portfolio sample data). Both SHALL have identical capabilities. No privileges, roles, or admin-only flags exist.

#### Scenario: Seed creates both users

- GIVEN the seed script runs with `ADMIN_PASSWORD` and `DEMO_PASSWORD` env vars set
- WHEN the seed completes
- THEN the `users` table contains exactly two rows: `admin` and `demo`
- AND both passwords are bcrypt-hashed from the respective env vars

#### Scenario: Identical privileges

- GIVEN both seeded users
- WHEN either user authenticates
- THEN both receive a JWT with the same payload shape and access scope
- AND the only isolation mechanism is `userId` filtering on data queries