# TYPO3 14 runtime — PHP 8.4 + Apache; project mounted at /var/www/html
FROM php:8.4-apache-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libicu-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    libonig-dev \
    libapache2-mod-auth-openidc \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
      pdo_pgsql \
      pgsql \
      intl \
      zip \
      opcache \
      gd \
      mbstring \
      xml \
      curl \
      exif \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php/typo3.ini /usr/local/etc/php/conf.d/99-typo3.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

COPY docker-entrypoint.sh /usr/local/bin/renis-typo3-entrypoint.sh
RUN chmod +x /usr/local/bin/renis-typo3-entrypoint.sh

WORKDIR /var/www/html

ENTRYPOINT ["/usr/local/bin/renis-typo3-entrypoint.sh"]
CMD ["apache2-foreground"]
