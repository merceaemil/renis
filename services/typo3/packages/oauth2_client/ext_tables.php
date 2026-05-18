<?php

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;
use Waldhacker\Oauth2Client\Backend\UserSettingsModule\ManageProvidersButtonRenderer;

defined('TYPO3') || die();

(static function () {
    $GLOBALS['TYPO3_USER_SETTINGS']['columns']['tx_oauth2_client_configs'] = [
        'label' => 'LLL:EXT:oauth2_client/Resources/Private/Language/locallang_be.xlf:userSettings.label',
        'type' => 'user',
        'userFunc' => ManageProvidersButtonRenderer::class . '->render',
    ];

    ExtensionManagementUtility::addFieldsToUserSettings(
        'tx_oauth2_client_configs',
        'after:mfaProviders'
    );
})();
