'use strict';

import { Cron } from 'croner';
import logger from '../lib/logger.js';
import mysql from '../models/db.model.js';
import Repository from '../models/repository.model.js';
import Datasource from '../models/datasource.model.js';
import Schedule from '../models/schedule.model.js';
import logConfig from '../../config/log.config.js';
import dayjs from 'dayjs';

/**
 * Centralized Cron Service
 * Manages all scheduled tasks for repositories, datasources, and schedules
 * Uses the application timezone from LOG_TZ (via log.config.js)
 */
class CronService {
  constructor() {
    this.jobs = {
      repositories: new Map(),
      datasources: new Map(),
      schedules: new Map(),
      system: new Map() // For maintenance tasks
    };
    this.timezone = logConfig.tz;
    logger.info(`Cron service initialized with timezone: ${this.timezone}`);
  }

  /**
   * Validate a cron expression
   */
  validateCronExpression(cronExpression) {
    try {
      // Try to create a Cron instance - it will throw if invalid
      const test = new Cron(cronExpression, { paused: true });
      test.stop();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Add or update a repository cron job
   */
  addRepository(name, cronExpression) {
    try {
      // Remove existing job if any
      this.removeRepository(name);

      if (!cronExpression || cronExpression.trim() === '') {
        logger.debug(`No cron expression for repository ${name}, skipping`);
        return;
      }

      // Validate cron expression
      if (!this.validateCronExpression(cronExpression)) {
        logger.error(`Invalid cron expression for repository ${name}: ${cronExpression}`);
        return;
      }

      // Create new cron job with Croner
      const task = new Cron(cronExpression, {
        timezone: this.timezone,
        paused: true,
        protect: true // Prevent overlapping runs
      }, async () => {
        logger.info(`Cron triggered for repository: ${name}`);
        try {
          // Check if repository is already running
          const repos = await mysql.do(
            "SELECT status FROM AnsibleForms.`repositories` WHERE name=? AND COALESCE(status,'')<>'running'",
            [name],
            true
          );
          
          if (repos.length > 0) {
            await Repository.pull(name).catch((e) => {
              logger.error(`Failed to pull repository ${name}:`, e);
            });
          } else {
            logger.debug(`Repository ${name} is already running, skipping cron execution`);
          }
        } catch (err) {
          logger.error(`Error in repository cron job for ${name}:`, err);
        }
      });

      task.resume();
      this.jobs.repositories.set(name, task);
      logger.info(`Added cron job for repository: ${name} with schedule: ${cronExpression}`);
    } catch (err) {
      logger.error(`Failed to add repository cron job for ${name}:`, err);
    }
  }

  /**
   * Remove a repository cron job
   */
  removeRepository(name) {
    const task = this.jobs.repositories.get(name);
    if (task) {
      task.stop();
      this.jobs.repositories.delete(name);
      logger.info(`Removed cron job for repository: ${name}`);
    }
  }

  /**
   * Add or update a datasource cron job
   */
  addDatasource(id, name, cronExpression) {
    try {
      // Remove existing job if any
      this.removeDatasource(id);

      if (!cronExpression || cronExpression.trim() === '') {
        logger.debug(`No cron expression for datasource ${name} (ID: ${id}), skipping`);
        return;
      }

      // Validate cron expression
      if (!this.validateCronExpression(cronExpression)) {
        logger.error(`Invalid cron expression for datasource ${name} (ID: ${id}): ${cronExpression}`);
        return;
      }

      // Create new cron job
      const task = new Cron(cronExpression, {
        timezone: this.timezone,
        paused: true,
        protect: true
      }, async () => {
        logger.info(`Cron triggered for datasource: ${name} (ID: ${id})`);
        try {
          // Check if datasource is already running or queued
          const datasources = await mysql.do(
            "SELECT id FROM AnsibleForms.`datasource` WHERE id=? AND COALESCE(status,'')<>'running' AND COALESCE(status,'')<>'queued'",
            [id],
            true
          );
          
          if (datasources.length > 0) {
            await Datasource.queue(id);
          } else {
            logger.debug(`Datasource ${name} (ID: ${id}) is already running or queued, skipping cron execution`);
          }
        } catch (err) {
          logger.error(`Error in datasource cron job for ${name} (ID: ${id}):`, err);
        }
      });

      task.resume();
      this.jobs.datasources.set(id, task);
      logger.info(`Added cron job for datasource: ${name} (ID: ${id}) with schedule: ${cronExpression}`);
    } catch (err) {
      logger.error(`Failed to add datasource cron job for ${name} (ID: ${id}):`, err);
    }
  }

  /**
   * Remove a datasource cron job
   */
  removeDatasource(id) {
    const task = this.jobs.datasources.get(id);
    if (task) {
      task.stop();
      this.jobs.datasources.delete(id);
      logger.info(`Removed cron job for datasource ID: ${id}`);
    }
  }

  /**
   * Add or update a schedule cron job
   */
  addSchedule(id, name, cronExpression, oneTimeRun, runAt) {
    try {
      // Remove existing job if any
      this.removeSchedule(id);

      if (oneTimeRun === 1 && runAt) {
        // One-time schedule: check every minute if it's time to run
        const task = new Cron('* * * * *', {
          timezone: this.timezone,
          paused: true,
          protect: true
        }, async () => {
          logger.debug(`Checking one-time schedule: ${name} (ID: ${id})`);
          try {
            const schedules = await mysql.do(
              "SELECT id, run_at FROM AnsibleForms.`schedule` WHERE id=? AND COALESCE(state,'')<>'running' AND COALESCE(state,'')<>'queued'",
              [id],
              true
            );
            
            if (schedules.length > 0) {
              const schedule = schedules[0];
              const runAtTime = dayjs(schedule.run_at);
              const now = dayjs();
              
              if (runAtTime.isBefore(now) || runAtTime.isSame(now, 'minute')) {
                logger.info(`One-time schedule triggered: ${name} (ID: ${id})`);
                await Schedule.queue(id);
              }
            }
          } catch (err) {
            logger.error(`Error in one-time schedule cron job for ${name} (ID: ${id}):`, err);
          }
        });

        task.resume();
        this.jobs.schedules.set(id, task);
        logger.info(`Added one-time schedule job for: ${name} (ID: ${id}) to run at: ${runAt}`);
      } else if (oneTimeRun === 0 && cronExpression && cronExpression.trim() !== '') {
        // Recurring cron schedule
        // Validate cron expression
        if (!this.validateCronExpression(cronExpression)) {
          logger.error(`Invalid cron expression for schedule ${name} (ID: ${id}): ${cronExpression}`);
          return;
        }

        const task = new Cron(cronExpression, {
          timezone: this.timezone,
          paused: true,
          protect: true
        }, async () => {
          logger.info(`Cron triggered for schedule: ${name} (ID: ${id})`);
          try {
            // Check if schedule is already running or queued
            const schedules = await mysql.do(
              "SELECT id FROM AnsibleForms.`schedule` WHERE id=? AND COALESCE(state,'')<>'running' AND COALESCE(state,'')<>'queued'",
              [id],
              true
            );
            
            if (schedules.length > 0) {
              await Schedule.queue(id);
            } else {
              logger.debug(`Schedule ${name} (ID: ${id}) is already running or queued, skipping cron execution`);
            }
          } catch (err) {
            logger.error(`Error in schedule cron job for ${name} (ID: ${id}):`, err);
          }
        });

        task.resume();
        this.jobs.schedules.set(id, task);
        logger.info(`Added cron job for schedule: ${name} (ID: ${id}) with schedule: ${cronExpression}`);
      }
    } catch (err) {
      logger.error(`Failed to add schedule cron job for ${name} (ID: ${id}):`, err);
    }
  }

  /**
   * Remove a schedule cron job
   */
  removeSchedule(id) {
    const task = this.jobs.schedules.get(id);
    if (task) {
      task.stop();
      this.jobs.schedules.delete(id);
      logger.info(`Removed cron job for schedule ID: ${id}`);
    }
  }

  /**
   * Initialize all cron jobs from database
   */
  async initializeAll() {
    logger.info('Initializing all cron jobs from database...');

    try {
      // Initialize repositories
      const repositories = await mysql.do(
        "SELECT name, cron FROM AnsibleForms.`repositories` WHERE cron<>''",
        undefined,
        true
      );
      repositories.forEach(repo => {
        this.addRepository(repo.name, repo.cron);
      });
      logger.info(`Initialized ${repositories.length} repository cron jobs`);
    } catch (err) {
      logger.error('Failed to initialize repository cron jobs:', err);
    }

    try {
      // Initialize datasources
      const datasources = await mysql.do(
        "SELECT id, name, cron FROM AnsibleForms.`datasource` WHERE cron<>''",
        undefined,
        true
      );
      datasources.forEach(ds => {
        this.addDatasource(ds.id, ds.name, ds.cron);
      });
      logger.info(`Initialized ${datasources.length} datasource cron jobs`);
    } catch (err) {
      logger.error('Failed to initialize datasource cron jobs:', err);
    }

    try {
      // Initialize schedules
      const schedules = await mysql.do(
        "SELECT id, name, one_time_run, cron, run_at FROM AnsibleForms.`schedule` WHERE (one_time_run=0 AND cron<>'') OR (one_time_run=1 AND run_at IS NOT NULL)",
        undefined,
        true
      );
      schedules.forEach(schedule => {
        this.addSchedule(schedule.id, schedule.name, schedule.cron, schedule.one_time_run, schedule.run_at);
      });
      logger.info(`Initialized ${schedules.length} schedule cron jobs`);
    } catch (err) {
      logger.error('Failed to initialize schedule cron jobs:', err);
    }

    logger.info('Cron service initialization complete');
  }

  /**
   * Initialize system maintenance tasks
   * These are internal maintenance jobs (not from database)
   */
  async initializeSystemTasks(Job, Token, BackupModel, appConfig) {
    logger.info('Initializing system maintenance tasks...');

    // 1. Abandoned jobs cleanup - runs every hour
    const abandonedJobsTask = new Cron('0 * * * *', {
      timezone: this.timezone,
      protect: true
    }, async () => {
      logger.info('Running abandoned jobs cleanup');
      try {
        const changed = await Job.abandon();
        if (changed > 0) {
          logger.warning(`Abandoned ${changed} jobs`);
        }
      } catch (err) {
        logger.error('Failed to abandon jobs:', err);
      }
    });
    this.jobs.system.set('abandonedJobs', abandonedJobsTask);
    logger.info('Initialized abandoned jobs cleanup (hourly)');

    // 2. Token cleanup - runs daily at 3:00 AM
    const tokenCleanupTask = new Cron('0 3 * * *', {
      timezone: this.timezone,
      protect: true
    }, async () => {
      logger.info('Running token cleanup');
      try {
        await Token.cleanup();
      } catch (err) {
        logger.error('Failed to cleanup tokens:', err);
      }
    });
    this.jobs.system.set('tokenCleanup', tokenCleanupTask);
    logger.info('Initialized token cleanup (daily at 3:00 AM)');

    // 3. Nightly backup - runs at midnight
    const nightlyBackupTask = new Cron('0 0 * * *', {
      timezone: this.timezone,
      protect: true
    }, async () => {
      logger.info('Running automated nightly backup');
      try {
        const result = await BackupModel.doBackup('Automated nightly backup');
        logger.info(`Nightly backup completed: ${result.backupFolder}`);
        
        // Cleanup old nightly backups
        logger.info(`Cleaning up nightly backups, keeping last ${appConfig.nightlyBackupRetention} backups`);
        const backups = await BackupModel.listBackups();
        const nightlyBackups = backups.filter(b => b.description === 'Automated nightly backup');
        
        if (nightlyBackups.length > appConfig.nightlyBackupRetention) {
          const toDelete = nightlyBackups.slice(appConfig.nightlyBackupRetention);
          for (const backup of toDelete) {
            logger.info(`Deleting old nightly backup: ${backup.folder}`);
            await BackupModel.deleteBackup(backup.folder);
          }
          logger.info(`Cleaned up ${toDelete.length} old nightly backups`);
        }
      } catch (err) {
        logger.error('Failed to create nightly backup:', err);
      }
    });
    this.jobs.system.set('nightlyBackup', nightlyBackupTask);
    logger.info('Initialized nightly backup (daily at midnight)');

    // 4. Stored jobs cleanup - runs daily at 4:00 AM
    const storedJobsCleanupTask = new Cron('0 4 * * *', {
      timezone: this.timezone,
      protect: true
    }, async () => {
      logger.info('Running stored jobs cleanup');
      try {
        const result = await mysql.do(
          "DELETE FROM AnsibleForms.stored_jobs WHERE expires_at IS NOT NULL AND expires_at < NOW()",
          undefined,
          true
        );
        if (result.affectedRows > 0) {
          logger.info(`Cleaned up ${result.affectedRows} expired stored job(s)`);
        }
      } catch (err) {
        logger.error('Failed to cleanup expired stored jobs:', err);
      }
    });
    this.jobs.system.set('storedJobsCleanup', storedJobsCleanupTask);
    logger.info('Initialized stored jobs cleanup (daily at 4:00 AM)');

    logger.info('System maintenance tasks initialization complete');
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    logger.info('Stopping all cron jobs...');
    
    this.jobs.repositories.forEach((task, name) => {
      task.stop();
      logger.debug(`Stopped repository cron job: ${name}`);
    });
    this.jobs.repositories.clear();

    this.jobs.datasources.forEach((task, id) => {
      task.stop();
      logger.debug(`Stopped datasource cron job: ${id}`);
    });
    this.jobs.datasources.clear();

    this.jobs.schedules.forEach((task, id) => {
      task.stop();
      logger.debug(`Stopped schedule cron job: ${id}`);
    });
    this.jobs.schedules.clear();

    this.jobs.system.forEach((task, name) => {
      task.stop();
      logger.debug(`Stopped system task: ${name}`);
    });
    this.jobs.system.clear();

    logger.info('All cron jobs stopped');
  }

  /**
   * Get status of all active cron jobs
   */
  getStatus() {
    return {
      repositories: Array.from(this.jobs.repositories.keys()),
      datasources: Array.from(this.jobs.datasources.keys()),
      schedules: Array.from(this.jobs.schedules.keys()),
      system: Array.from(this.jobs.system.keys())
    };
  }
}

// Export singleton instance
const cronService = new CronService();
export default cronService;
