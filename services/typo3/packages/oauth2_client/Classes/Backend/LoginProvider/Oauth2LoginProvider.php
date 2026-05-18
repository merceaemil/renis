<?php

declare(strict_types=1);

namespace Waldhacker\Oauth2Client\Backend\LoginProvider;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\LoginProvider\LoginProviderInterface;
use TYPO3\CMS\Core\View\ViewInterface;
use TYPO3\CMS\Fluid\View\FluidViewAdapter;
use Waldhacker\Oauth2Client\Service\Oauth2ProviderManager;

class Oauth2LoginProvider implements LoginProviderInterface
{
    public const PROVIDER_ID = '1616569531';

    public function __construct(
        private readonly Oauth2ProviderManager $oauth2ProviderManager,
    ) {
    }

    public function modifyView(ServerRequestInterface $request, ViewInterface $view): string
    {
        if ($view instanceof FluidViewAdapter) {
            $templatePaths = $view->getRenderingContext()->getTemplatePaths();
            $templatePaths->setTemplateRootPaths(array_merge(
                ['EXT:oauth2_client/Resources/Private/Templates/'],
                $templatePaths->getTemplateRootPaths(),
            ));
        }

        $view->assign('providers', $this->oauth2ProviderManager->getConfiguredBackendProviders());

        return 'Backend/Oauth2LoginProvider';
    }
}
