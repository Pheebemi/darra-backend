# Running the tests

```bash
python manage.py test users products apps.payments.tests apps.support.tests --buffer
```

`--buffer` hides the app's `print()` output for passing tests and shows it only
when one fails.

## Why the explicit labels

A bare `python manage.py test` only discovers the top-level apps (`users`,
`products`) and silently skips the ones under `apps/` (`apps.payments`,
`apps.support`) — nested-package test discovery doesn't pick them up. So list
them explicitly, or you'll see "Ran 26 tests" and miss half the suite.

Run one file while working on it:

```bash
python manage.py test apps.payments.tests --buffer
```

## What is covered

- **apps/payments** — the payment webhook (forged/unsigned rejected, signature
  required, provider re-verified, amount-tampering blocked) and the
  idempotency guard against duplicate fulfilment.
- **products** — paid files never exposed by the API, seller-named ticket
  categories and their validation, list pagination and ordering.
- **users** — registration validation, the full password-reset flow (no email
  enumeration, single-use token, weak-password rejection), and that the login
  rate limit actually fires.
- **apps/support** — the AI chat proxy (key-gated, payload-validated, provider
  errors not leaked) and the contact handoff (saved, admins emailed, throttled).

Fixtures are in `core/test_factories.py`.
