#!/bin/bash
# Creates additional databases on first PostgreSQL startup (dev defaults).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
CREATE USER keycloak WITH PASSWORD 'keycloak_dev_password';
CREATE DATABASE keycloak OWNER keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

CREATE USER typo3 WITH PASSWORD 'typo3_dev_password';
CREATE DATABASE typo3 OWNER typo3;
GRANT ALL PRIVILEGES ON DATABASE typo3 TO typo3;
EOSQL
