FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git rsync awscli openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
