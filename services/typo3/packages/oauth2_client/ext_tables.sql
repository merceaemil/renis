CREATE TABLE tx_oauth2_beuser_provider_configuration (
  parentid int(10) DEFAULT 0 NOT NULL,
  provider varchar(255) DEFAULT '',
  identifier varchar(255) DEFAULT '',
  KEY parent (parentid)
);

CREATE TABLE tx_oauth2_feuser_provider_configuration (
  parentid int(11) DEFAULT 0 NOT NULL,
  provider varchar(255) DEFAULT '',
  identifier varchar(255) DEFAULT '',
  KEY parent (parentid)
);

CREATE TABLE be_users (
  tx_oauth2_client_configs INT UNSIGNED DEFAULT 0 NOT NULL
);

CREATE TABLE fe_users (
  tx_oauth2_client_configs INT UNSIGNED DEFAULT 0 NOT NULL
);
