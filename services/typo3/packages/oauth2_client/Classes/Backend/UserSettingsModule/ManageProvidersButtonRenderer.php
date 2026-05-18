<?php

declare(strict_types=1);

/*
 * This file is part of the OAuth2 Client extension for TYPO3
 * - (c) 2021 waldhacker UG (haftungsbeschränkt)
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */

namespace Waldhacker\Oauth2Client\Backend\UserSettingsModule;

use Doctrine\DBAL\Exception;
use TYPO3\CMS\Backend\Routing\Exception\RouteNotFoundException;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Context\Context;
use TYPO3\CMS\Core\Context\Exception\AspectNotFoundException;
use TYPO3\CMS\Core\Imaging\IconFactory;
use TYPO3\CMS\Core\Imaging\Icon;
use TYPO3\CMS\Core\Localization\LanguageService;
use Waldhacker\Oauth2Client\Repository\BackendUserRepository;
use Waldhacker\Oauth2Client\Service\Oauth2ProviderManager;

class ManageProvidersButtonRenderer
{
    public function __construct(
        private readonly UriBuilder $uriBuilder,
        private readonly BackendUserRepository $backendUserRepository,
        private readonly Oauth2ProviderManager $oauth2ProviderManager,
        private readonly IconFactory $iconFactory,
        private readonly Context $context,
    ) {
    }

    /**
     * @throws AspectNotFoundException
     * @throws RouteNotFoundException
     * @throws Exception
     */
    public function render(): string
    {
        $html = '';
        $languageFile = 'LLL:EXT:oauth2_client/Resources/Private/Language/locallang_be.xlf:';
        $lang = $this->getLanguageService();
        $userid = (int)$this->context->getPropertyFromAspect('backend.user', 'id');
        $activeProviders = $this->backendUserRepository->getActiveProviders($userid);
        $hasActiveProviders = count($activeProviders) > 0;
        if ($hasActiveProviders) {
            $html .= ' <span class="badge badge-success">'
                . htmlspecialchars($lang->sL($languageFile . 'oauth2Providers.enabled'), ENT_QUOTES | ENT_HTML5)
                . '</span>';
        }
        $html .= '<p class="text-muted">'
            . nl2br(htmlspecialchars($lang->sL($languageFile . 'oauth2Providers.description'), ENT_QUOTES | ENT_HTML5))
            . '</p>';
        if ($this->oauth2ProviderManager->getConfiguredBackendProviders() === null) {
            $html .= '<span class="badge badge-danger">'
                . htmlspecialchars($lang->sL($languageFile . 'oauth2Providers.notAvailable'), ENT_QUOTES | ENT_HTML5)
                . '</span><br />';
        } else {
            $html .= '<a href="'
                . htmlspecialchars(
                    (string)$this->uriBuilder->buildUriFromRoute('oauth2_manage_providers'),
                    ENT_QUOTES | ENT_HTML5
                )
                . '" class="btn btn-' . ($activeProviders ? 'default' : 'success') . '">';
            $html .= $this->iconFactory->getIcon($hasActiveProviders ? 'actions-cog' : 'actions-add', Icon::SIZE_SMALL);
            $html .= ' <span>'
                . htmlspecialchars(
                    $lang->sL(
                        $languageFile . 'oauth2Providers.' . ($activeProviders ? 'manageLinkTitle' : 'setupLinkTitle')
                    ),
                    ENT_QUOTES | ENT_HTML5
                )
                . '</span>';
            $html .= '</a>';
        }
        return $html;
    }

    private function getLanguageService(): LanguageService
    {
        return $GLOBALS['LANG'];
    }
}
