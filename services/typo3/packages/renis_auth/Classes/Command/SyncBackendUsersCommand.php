<?php

declare(strict_types=1);

namespace Renis\Auth\Command;

use Doctrine\DBAL\ParameterType;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use TYPO3\CMS\Core\Crypto\PasswordHashing\PasswordHashFactory;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Creates/updates TYPO3 backend users from active RENIS platform accounts (email match for Keycloak).
 */
final class SyncBackendUsersCommand extends Command
{
    public function __construct(
        private readonly ConnectionPool $connectionPool,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('renis_auth:sync-backend-users')
            ->setDescription(
                'Sync active RENIS users into be_users (email = Keycloak login, required for OAuth backend login).'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $dsn = $this->resolveRenisDatabaseUrl();
        if ($dsn === null) {
            $io->warning(
                'RENIS_DATABASE_URL not set — skipped backend user sync.'
            );
            return Command::SUCCESS;
        }

        try {
            $pdo = new \PDO($dsn);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        } catch (\Throwable $e) {
            $io->error('Could not connect to RENIS database: ' . $e->getMessage());
            return Command::FAILURE;
        }

        $rows = $pdo->query(
            "SELECT email, first_name, last_name, role FROM users WHERE status = 'ACTIVE' ORDER BY email"
        )->fetchAll(\PDO::FETCH_ASSOC);

        if ($rows === []) {
            $io->warning('No active users in RENIS database. Run db-seed first.');
            return Command::SUCCESS;
        }

        $passwordHash = GeneralUtility::makeInstance(PasswordHashFactory::class)
            ->getDefaultHashInstance('BE')
            ->getHashedPassword(bin2hex(random_bytes(16)));

        $now = time();
        $synced = 0;

        foreach ($rows as $row) {
            $email = (string) $row['email'];
            if ($email === '') {
                continue;
            }

            $realName = trim((string) $row['first_name'] . ' ' . (string) $row['last_name']);
            $isAdmin = in_array(
                (string) $row['role'],
                ['SUPER_ADMIN', 'MINISTRY_ADMIN'],
                true
            ) ? 1 : 0;

            $existing = $this->findBackendUserByEmail($email);
            if ($existing !== null) {
                $this->updateBackendUser((int) $existing['uid'], $email, $realName, $isAdmin, $now);
                $io->writeln("Updated backend user: {$email}");
            } else {
                $this->insertBackendUser($email, $realName, $isAdmin, $passwordHash, $now);
                $io->writeln("Created backend user: {$email}");
            }
            $synced++;
        }

        $io->success("Synced {$synced} RENIS user(s) into be_users.");
        return Command::SUCCESS;
    }

    private function resolveRenisDatabaseUrl(): ?string
    {
        $url = getenv('RENIS_DATABASE_URL') ?: getenv('DATABASE_URL_RENIS');
        if (is_string($url) && $url !== '') {
            return $this->normalizePostgresDsn($url);
        }

        $user = getenv('RENIS_DB_USER') ?: getenv('POSTGRES_USER');
        $password = getenv('RENIS_DB_PASSWORD') ?: getenv('POSTGRES_PASSWORD');
        $host = getenv('RENIS_DB_HOST') ?: 'postgres';
        $port = getenv('RENIS_DB_PORT') ?: '5432';
        $db = getenv('RENIS_DB_NAME') ?: getenv('POSTGRES_DB') ?: 'renis';

        if (!is_string($user) || $user === '') {
            return null;
        }

        $pass = is_string($password) ? $password : '';
        return sprintf(
            'pgsql:host=%s;port=%s;dbname=%s',
            $host,
            $port,
            $db
        ) . ';user=' . $user . ';password=' . $pass;
    }

    private function normalizePostgresDsn(string $url): string
    {
        if (str_starts_with($url, 'pgsql:')) {
            return $url;
        }
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['host'], $parts['path'])) {
            return $url;
        }
        $db = ltrim((string) $parts['path'], '/');
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s',
            $parts['host'],
            $parts['port'] ?? 5432,
            $db
        );
        if (isset($parts['user'])) {
            $dsn .= ';user=' . $parts['user'];
        }
        if (isset($parts['pass'])) {
            $dsn .= ';password=' . $parts['pass'];
        }
        return $dsn;
    }

    private function findBackendUserByEmail(string $email): ?array
    {
        $qb = $this->connectionPool->getQueryBuilderForTable('be_users');
        $row = $qb
            ->select('uid', 'email', 'username')
            ->from('be_users')
            ->where(
                $qb->expr()->and(
                    $qb->expr()->eq('deleted', 0),
                    $qb->expr()->or(
                        $qb->expr()->eq('email', $qb->createNamedParameter($email)),
                        $qb->expr()->eq('username', $qb->createNamedParameter($email)),
                    ),
                ),
            )
            ->setMaxResults(1)
            ->executeQuery()
            ->fetchAssociative();

        return is_array($row) ? $row : null;
    }

    private function updateBackendUser(
        int $uid,
        string $email,
        string $realName,
        int $admin,
        int $tstamp,
    ): void {
        $qb = $this->connectionPool->getQueryBuilderForTable('be_users');
        $qb->update('be_users')
            ->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, ParameterType::INTEGER)))
            ->set('username', $email)
            ->set('email', $email)
            ->set('realName', $realName)
            ->set('admin', $admin)
            ->set('disable', 0)
            ->set('deleted', 0)
            ->set('tstamp', $tstamp)
            ->executeStatement();
    }

    private function insertBackendUser(
        string $email,
        string $realName,
        int $admin,
        string $passwordHash,
        int $now,
    ): void {
        $qb = $this->connectionPool->getQueryBuilderForTable('be_users');
        $qb->insert('be_users')
            ->values([
                'pid' => 0,
                'tstamp' => $now,
                'crdate' => $now,
                'deleted' => 0,
                'disable' => 0,
                'username' => $email,
                'password' => $passwordHash,
                'email' => $email,
                'realName' => $realName,
                'admin' => $admin,
                'options' => 3,
                'workspace_perms' => 1,
                'lang' => 'en',
            ])
            ->executeStatement();
    }
}
