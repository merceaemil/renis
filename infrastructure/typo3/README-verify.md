# Public verify portal (TYPO3 + widget)

The `renis_verify` extension embeds the RENIS widget on the TYPO3 frontend.

## URLs

| URL | Purpose |
|-----|---------|
| http://localhost:8082/verify | Public verification page |
| http://localhost:8082/verify?code=UUID | Pre-filled code (QR deep link) |
| http://localhost:3001 | Widget assets (`renis-verify.iife.js`) |
| http://localhost:3000/api/verify/:code | Verification API |

## Setup

After `docker compose up -d typo3 widget management`:

```bash
sh infrastructure/typo3/apply-verify-extension.sh
```

Or manually (use `--no-scripts` on composer to avoid a removed TYPO3 CLI command):

```bash
docker compose exec typo3 composer require renis/verify:@dev --no-interaction --no-scripts
docker compose exec typo3 php vendor/bin/typo3 extension:setup -n
docker compose exec typo3 php vendor/bin/typo3 renis_verify:setup-page
docker compose exec typo3 php vendor/bin/typo3 cache:flush
```

The extension is copied from `infrastructure/typo3/renis_verify` on container start.

## Embed elsewhere

```html
<div data-renis-verify data-api-url="http://localhost:3000"></div>
<script src="http://localhost:3001/renis-verify.iife.js" defer></script>
```

Or `window.RenisVerify.init('[data-renis-verify]')`.
