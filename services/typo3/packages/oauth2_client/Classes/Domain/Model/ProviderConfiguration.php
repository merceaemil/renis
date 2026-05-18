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

namespace Waldhacker\Oauth2Client\Domain\Model;

use InvalidArgumentException;
use League\OAuth2\Client\Provider\AbstractProvider;

class ProviderConfiguration
{
    public function __construct(
        private readonly string $identifier,
        private readonly string $label,
        private readonly string $description,
        private readonly string $iconIdentifier,
        private readonly string $implementationClassName,
        private readonly array $scopes,
        private readonly array $options,
        private readonly array $collaborators
    ) {
        if (
            !class_exists($this->implementationClassName)
            || !is_a($this->implementationClassName, AbstractProvider::class, true)
        ) {
            throw new InvalidArgumentException(
                'Registered class ' . $this->implementationClassName
                . ' does not exist or is not an implementation of ' . AbstractProvider::class,
                1642867945
            );
        }
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getIconIdentifier(): string
    {
        return $this->iconIdentifier;
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function getImplementationClassName(): string
    {
        return $this->implementationClassName;
    }

    public function getScopes(): array
    {
        return $this->scopes;
    }

    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function getCollaborators(): array
    {
        return $this->collaborators;
    }
}
