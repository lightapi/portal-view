#!/bin/bash
echo "Build the view in in test mode"
yarn build-tst
echo "Build completed in build folder, start copying to remote portal server"
ssh portal "rm -rf ~/lightapi/portal-config-loc/light-gateway/lightapi/dist"
scp -r ./dist portal:/home/steve/lightapi/portal-config-loc/light-gateway/lightapi
echo "Copied!"
