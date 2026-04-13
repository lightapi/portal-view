#!/bin/bash
echo "Build the view in in prod mode"
npm run build-prd
echo "Build completed in build folder, start copying to remote prod1 server"
ssh prod1 "rm -rf ~/networknt/light-config-prod/prod1/lightapi/build"
scp -r ./build prod1:/home/steve/networknt/light-config-prod/prod1/lightapi
echo "Copied!"
