# portal-view
A react light-portal UI as a template for single page applications that interact with back end APIs


### Live Site

The source code in this repository is deployed to [lightapi.net](https://lightapi.net/). 

## Build Static Assets

Vite reads `.env` and `VITE_*` environment variables at build time. If a
target host, API base URL, or sign-in URL changes, rebuild `portal-view` and
copy the generated `dist` directory into the asset repository used by that
target.

Run `npm install` before the first build if `node_modules` is not present.

### portal-config-loc lightapi into service-asset

Use this build for the local `portal-config-loc` stack. It writes the built
LightAPI portal assets to `service-asset/lightapi/dist`, which is the shared
source for local gateway UI assets.

```bash
cd ~/lightapi/portal-view
VITE_API_BASE_URL=https://localhost \
VITE_SIGNIN_URL='https://signin.localhost?client_id=f7d42348-c647-4efb-a52d-4c5787421e72' \
npm run build

rm -rf ~/lightapi/service-asset/lightapi/dist
mkdir -p ~/lightapi/service-asset/lightapi
cp -a dist ~/lightapi/service-asset/lightapi/
```

Then start the local stack:

```bash
cd ~/lightapi/portal-config-loc
./scripts/deploy-local.sh pg rust
```

`deploy-local.sh` copies from `service-asset` when the selected gateway asset
directory is missing. If the stack already has an older gateway `dist`, remove
that target directory first or copy the updated `service-asset/lightapi/dist`
into the selected gateway path before restarting.

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
