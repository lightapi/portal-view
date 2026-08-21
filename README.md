# portal-view
A react light-portal UI as a template for single page applications that interact with back end APIs


### Live Site

The source code in this repository is deployed to [lightapi.net](https://lightapi.net/). 

## Build Static Assets

Vite reads `.env` and `VITE_*` environment variables at build time. If a
target host, API base URL, or sign-in URL changes, rebuild `portal-view` and
copy the generated `dist` directory into the deployment target used by that
environment.

The committed `.env` leaves `VITE_API_BASE_URL` empty so default builds use
same-origin API paths and do not bake a localhost URL into non-local assets.
Set `VITE_API_BASE_URL` explicitly in local or target-specific build commands
when the API is not served from the same origin.

Run `npm install` before the first build if `node_modules` is not present.

### portal-config-loc local lightapi assets

Use this build for the local `portal-config-loc` stack. Released assets normally
come from the configured CDN. To test a local build, copy it directly into the
selected gateway directory; `deploy-local.sh` preserves a populated UI target.

```bash
cd ~/lightapi/portal-view
VITE_API_BASE_URL=https://localhost \
VITE_SIGNIN_URL='https://signin.localhost?client_id=f7d42348-c647-4efb-a52d-4c5787421e72' \
npm run build

rm -rf ~/lightapi/portal-config-loc/all-in-pg/light-gateway/lightapi/dist
mkdir -p ~/lightapi/portal-config-loc/all-in-pg/light-gateway/lightapi
cp -a dist ~/lightapi/portal-config-loc/all-in-pg/light-gateway/lightapi/
```

Then start the local stack:

```bash
cd ~/lightapi/portal-config-loc
./scripts/deploy-local.sh pg rust
```

If the selected gateway directory is missing or empty, `deploy-local.sh`
downloads the released `lightapi.zip` archive from the CDN instead. Set
`REFRESH_RELEASE_ASSETS=true` when you intentionally want to refresh cached
release archives; populated local UI directories remain developer-controlled.

### portal-config-dev lightapi into asset-dev

Use this build for the dev `portal-config-dev` deployment. It writes the built
LightAPI portal assets to `asset-dev/lightapi/dist`, which
`portal-config-dev/scripts/sync-assets.sh` copies into
`portal-config-dev/light-gateway-rust/lightapi/dist`.

```bash
cd ~/lightapi/portal-view
VITE_API_BASE_URL=https://dev.lightapi.net \
VITE_SIGNIN_URL='https://devsignin.lightapi.net?client_id=f7d42348-c647-4efb-a52d-4c5787421e72' \
npm run build

rm -rf ~/lightapi/asset-dev/lightapi/dist
mkdir -p ~/lightapi/asset-dev/lightapi
cp -a dist ~/lightapi/asset-dev/lightapi/
```

Then sync the dev deployment assets:

```bash
cd ~/lightapi/portal-config-dev
ASSET_DEV_DIR=~/lightapi/asset-dev ./scripts/sync-assets.sh
```
