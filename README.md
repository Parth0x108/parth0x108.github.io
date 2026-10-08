# Parth0x108

Personal blockchain security portfolio at [parth0x108.github.io](https://parth0x108.github.io).

The static website lives in `dist/`. All four pages are served as directory routes. Pushes to `main` are verified and deployed by GitHub Actions.

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

## Checks

```sh
python3 scripts/verify-site.py
node --check dist/site.js
npx --yes html-validate@11.4.0 dist/index.html dist/work/index.html dist/writing/index.html dist/bounties/index.html dist/404.html
```

Site title: Parth0x108. Favicons use the existing anime profile image. No runtime dependencies or backend are required.
