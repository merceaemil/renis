<?php

use TYPO3\CMS\Extbase\Utility\ExtensionUtility;

defined('TYPO3') or die();

ExtensionUtility::registerPlugin(
    extensionName: 'RenisVerify',
    pluginName: 'Show',
    pluginTitle: 'RENIS diploma verification',
    pluginDescription: 'Embeds the RENIS verify widget (public portal)',
    pluginIcon: 'content-plugin',
);
