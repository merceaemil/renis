<?php

declare(strict_types=1);

namespace Renis\Auth\EventListener;

use TYPO3\CMS\Core\Database\ConnectionPool;
use Waldhacker\Oauth2Client\Events\BackendUserLookupEvent;
use Waldhacker\Oauth2Client\Repository\BackendUserRepository;

final class KeycloakBackendUserLookupListener
{
    private const PROVIDER_ID = "keycloak";

    public function __construct(
        private readonly ConnectionPool $connectionPool,
        private readonly BackendUserRepository $backendUserRepository,
    ) {
    }

    public function __invoke(BackendUserLookupEvent $event): void
    {
        if ($event->getProviderId() !== self::PROVIDER_ID) {
            return;
        }

        if ($event->getTypo3User() !== null) {
            return;
        }

        $remoteUser = $event->getRemoteUser();
        $claims = $remoteUser->toArray();
        $email = $claims["email"] ?? $claims["preferred_username"] ?? null;
        if (!is_string($email) || $email === "") {
            return;
        }

        $beUser = $this->findActiveBackendUserByEmail($email);
        if ($beUser === null) {
            return;
        }

        $identity = (string) $remoteUser->getId();
        if ($identity !== "") {
            $this->backendUserRepository->persistIdentityForUser(
                self::PROVIDER_ID,
                $identity,
                (int) $beUser["uid"],
            );
        }

        $event->setTypo3User($beUser);
    }

    private function findActiveBackendUserByEmail(string $email): ?array
    {
        $qb = $this->connectionPool->getQueryBuilderForTable("be_users");
        $rows = $qb
            ->select("*")
            ->from("be_users")
            ->where(
                $qb->expr()->and(
                    $qb->expr()->eq("disable", 0),
                    $qb->expr()->eq("deleted", 0),
                    $qb->expr()->or(
                        $qb->expr()->eq("email", $qb->createNamedParameter($email)),
                        $qb->expr()->eq("username", $qb->createNamedParameter($email)),
                    ),
                ),
            )
            ->setMaxResults(2)
            ->executeQuery()
            ->fetchAllAssociative();

        if (count($rows) !== 1) {
            return null;
        }

        return $rows[0];
    }
}
