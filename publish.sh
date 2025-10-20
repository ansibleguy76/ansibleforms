#! /bin/sh

docker build -t ansibleforms .
docker tag ansibleforms ansibleguy/ansibleforms
docker push ansibleguy/ansibleforms
version=$(jq .version ./package.json -r)
docker tag ansibleforms ansibleguy/ansibleforms:$version
docker push ansibleguy/ansibleforms:$version
docker rmi $(docker images -f "dangling=true" -q) -f
