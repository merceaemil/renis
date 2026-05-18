<?php

defined('TYPO3') or die();

\TYPO3\CMS\Extbase\Utility\ExtensionUtility::configurePlugin(
    extensionName: 'RenisVerify',
    pluginName: 'Show',
    controllerActions: [
        \Renis\Verify\Controller\VerifyController::class => 'show',
    ],
    nonCacheableControllerActions: [
        \Renis\Verify\Controller\VerifyController::class => 'show',
    ],
);
