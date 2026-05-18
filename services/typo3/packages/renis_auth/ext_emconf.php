<?php

$EM_CONF[$_EXTKEY] = [
    "title" => "RENIS Keycloak auth",
    "description" => "Maps Keycloak users to TYPO3 backend users by email",
    "category" => "auth",
    "author" => "RENIS-BI",
    "state" => "stable",
    "version" => "1.0.0",
    "constraints" => [
        "depends" => [
            "typo3" => "14.0.0-14.4.99",
            "oauth2_client" => "4.0.0-4.99.99",
        ],
    ],
    "autoload" => [
        "psr-4" => [
            "Renis\\Auth\\" => "Classes",
        ],
    ],
];
