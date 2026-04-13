#!/bin/bash
echo "Build the view in in local mode"
npm run build-tst
echo "Build completed in build folder, start copying to local folder"
rm -rf /home/steve/lightapi/portal-config-loc/light-gateway/lightapi/dist
cp -r ./dist /home/steve/lightapi/portal-config-loc/light-gateway/lightapi
echo "Copied!"
