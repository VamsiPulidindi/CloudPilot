#!/bin/bash
set -eux

export DEBIAN_FRONTEND=noninteractive

apt-get update -y

apt-get install -y \
    docker.io \
    docker-compose-v2 \
    git \
    curl

systemctl enable docker
systemctl start docker

usermod -aG docker ubuntu

mkdir -p /opt

cd /opt

if [ ! -d cloudpilot ]; then
    git clone ${github_repo}
fi

cd cloudpilot

docker compose up -d --build


echo "CloudPilot deployed successfully"
