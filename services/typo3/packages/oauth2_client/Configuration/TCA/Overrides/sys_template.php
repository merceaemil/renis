<?php

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;

defined('TYPO3') or die();

(static function () {
    ExtensionManagementUtility::addStaticFile('oauth2_client', 'Configuration/TypoScript', 'OAuth2 templates');
})();
