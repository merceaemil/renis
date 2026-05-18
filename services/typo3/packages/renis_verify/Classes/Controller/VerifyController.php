<?php

declare(strict_types=1);

namespace Renis\Verify\Controller;

use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;

final class VerifyController extends ActionController
{
    public function showAction(): ResponseInterface
    {
        $widgetUrl = rtrim((string)(getenv('WIDGET_PUBLIC_URL') ?: 'http://localhost:3001'), '/');
        $apiUrl = rtrim((string)(getenv('MANAGEMENT_PUBLIC_URL') ?: 'http://localhost:3000'), '/');
        $code = trim((string)($this->request->getQueryParams()['code'] ?? $this->request->getQueryParams()['verify'] ?? ''));

        $this->view->assignMultiple([
            'widgetUrl' => $widgetUrl,
            'apiUrl' => $apiUrl,
            'initialCode' => $code,
        ]);

        return $this->htmlResponse();
    }
}
