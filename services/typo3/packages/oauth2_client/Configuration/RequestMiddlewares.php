<?php

use Waldhacker\Oauth2Client\Middleware\Backend\BeforeAuthenticationHandler as BackendBeforeAuthenticationHandler;
use Waldhacker\Oauth2Client\Middleware\Frontend\AfterAuthenticationHandler;
use Waldhacker\Oauth2Client\Middleware\Frontend\BeforeAuthenticationHandler as FrontendBeforeAuthenticationHandler;

return [
    'backend' => [
        'oauth2-before-authentication' => [
            'target' => BackendBeforeAuthenticationHandler::class,
            'before' => [
                'typo3/cms-backend/authentication',
            ],
            'after' => [
                'typo3/cms-backend/backend-routing',
            ],
        ],
    ],
    'frontend' => [
        'oauth2-before-authentication' => [
            'target' => FrontendBeforeAuthenticationHandler::class,
            'before' => [
                'typo3/cms-frontend/authentication',
            ],
            'after' => [
                'typo3/cms-frontend/site',
                'typo3/cms-frontend/maintenance-mode',
            ],
        ],
        'oauth2-after-authentication' => [
            'target' => AfterAuthenticationHandler::class,
            'before' => [
                'typo3/cms-frontend/base-redirect-resolver',
                'typo3/cms-redirects/redirecthandler',
                'typo3/cms-adminpanel/initiator',
            ],
            'after' => [
                'typo3/cms-frontend/authentication',
            ],
        ],
    ],
];
