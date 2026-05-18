<?php

declare(strict_types=1);

namespace Renis\Verify\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use TYPO3\CMS\Core\Database\Connection;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * TYPO3 14: plugins use dedicated CType (e.g. renisverify_show), not list + list_type.
 */
final class SetupVerifyPageCommand extends Command
{
    private const PLUGIN_CTYPE = 'renisverify_show';

    protected function configure(): void
    {
        $this->setDescription('Create /verify frontend page with RENIS widget plugin');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $pages = $this->connection('pages');
        $content = $this->connection('tt_content');

        $pageUid = $this->resolveVerifyPageUid($pages, $output);
        if ($pageUid === 0) {
            return Command::FAILURE;
        }

        $existingContent = $content
            ->select(['uid', 'CType'], 'tt_content', ['pid' => $pageUid])
            ->fetchAllAssociative();

        foreach ($existingContent as $row) {
            if (($row['CType'] ?? '') === self::PLUGIN_CTYPE) {
                $output->writeln(
                    '<info>Verify page (uid ' . $pageUid . ') already has the widget content element (uid '
                    . $row['uid'] . ').</info>'
                );
                return Command::SUCCESS;
            }
        }

        $now = time();
        $content->insert('tt_content', [
            'pid' => $pageUid,
            'CType' => self::PLUGIN_CTYPE,
            'header' => 'Diploma verification',
            'colPos' => 0,
            'hidden' => 0,
            'sys_language_uid' => 0,
            'sorting' => 256,
            'tstamp' => $now,
            'crdate' => $now,
        ]);

        $output->writeln(
            '<info>Added widget content element to verify page uid ' . $pageUid . ' (CType '
            . self::PLUGIN_CTYPE . ').</info>'
        );
        $output->writeln('<info>Open http://localhost:8082/verify</info>');

        return Command::SUCCESS;
    }

    private function resolveVerifyPageUid(Connection $pages, OutputInterface $output): int
    {
        $rows = $pages
            ->select(['uid'], 'pages', ['slug' => '/verify'])
            ->fetchAllAssociative();

        if (count($rows) > 1) {
            $output->writeln(
                '<comment>Multiple pages with slug /verify found; using uid ' . $rows[0]['uid'] . '.</comment>'
            );
        }

        if (count($rows) >= 1) {
            $uid = (int)$rows[0]['uid'];
            $output->writeln('<info>Using existing verify page (uid ' . $uid . ').</info>');
            return $uid;
        }

        $now = time();
        $pages->insert('pages', [
            'pid' => 1,
            'slug' => '/verify',
            'title' => 'Verify a diploma',
            'doktype' => 1,
            'hidden' => 0,
            'is_siteroot' => 0,
            'sys_language_uid' => 0,
            'tstamp' => $now,
            'crdate' => $now,
        ]);

        $pageUid = (int)$pages->lastInsertId('pages');
        $output->writeln('<info>Created verify page uid ' . $pageUid . ' at /verify</info>');

        return $pageUid;
    }

    private function connection(string $table): Connection
    {
        return GeneralUtility::makeInstance(ConnectionPool::class)->getConnectionForTable($table);
    }
}
