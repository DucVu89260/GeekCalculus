FROM composer:2@sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac AS composer
FROM php:8.4-cli-bookworm@sha256:836ac6c672d1372a47c8fd61b625015bd07760f493fb2eaab2087636498a2b4b

# The private PDF inspector runs alongside Laravel. Both database drivers remain
# available; choosing PostgreSQL does not convert or remove an existing SQLite DB.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-fitz \
       libpq-dev libsqlite3-dev libonig-dev libxml2-dev libzip-dev unzip \
    && docker-php-ext-install -j2 pdo_pgsql pdo_sqlite mbstring dom xml xmlwriter zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
WORKDIR /app/backend/laravel
