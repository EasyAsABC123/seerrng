import WhisparrAPI, { type WhisparrScene } from '@server/api/servarr/whisparr';
import { getExternalRuntimeConfig } from '@server/lib/externalRuntimeConfig';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import { runWithServarrServiceSnapshot } from '@server/lib/serviceAdmission';
import type { WhisparrSettings } from '@server/lib/settings';
import { normalizeStashDbId } from '@server/lib/stashdbIdentity';

type SyncStatus = StatusBase & {
  currentServer?: WhisparrSettings;
  servers: WhisparrSettings[];
};

class WhisparrScanner
  extends BaseScanner<WhisparrScene>
  implements RunnableScanner<SyncStatus>
{
  private servers: WhisparrSettings[] = [];
  private currentServer?: WhisparrSettings;
  private scanHadProcessingErrors = false;

  constructor() {
    super('Whisparr Adult Scene Scan', { bundleSize: 10, updateRate: 1000 });
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
      currentServer: this.currentServer,
      servers: this.servers,
    };
  }

  public async run(): Promise<void> {
    const settings = getExternalRuntimeConfig();
    const sessionId = this.startRun();
    if (!sessionId) return;

    try {
      this.servers = structuredClone(settings.whisparr);
      for (const server of this.servers) {
        this.currentServer = server;
        if (!server.syncEnabled) continue;

        try {
          this.log(`Beginning Whisparr scene scan: ${server.name}`, 'info');
          const scanStartedAt = new Date();
          this.scanHadProcessingErrors = false;
          this.items = await runWithServarrServiceSnapshot(
            'whisparr',
            server,
            async (current) =>
              new WhisparrAPI({
                apiKey: current.apiKey,
                url: WhisparrAPI.buildUrl(current, '/api/v3'),
              }).getScenes()
          );
          await this.loop(this.processScene.bind(this), { sessionId });
          if (this.scanHadProcessingErrors) {
            this.log(
              'Skipping Whisparr stale-scene reconciliation because some scenes failed to process',
              'warn',
              { serviceId: server.id }
            );
          } else {
            await runWithServarrServiceSnapshot('whisparr', server, () =>
              this.markMissingAdultServiceStatusesUnknown(
                server.id,
                scanStartedAt
              )
            );
          }
        } catch (error) {
          this.log('Whisparr scene scan failed', 'error', {
            serviceId: server.id,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        }
      }
      this.log('Whisparr scene scan complete', 'info');
    } finally {
      this.currentServer = undefined;
      this.endRun(sessionId);
    }
  }

  private async processScene(scene: WhisparrScene): Promise<void> {
    const stashDbId = normalizeStashDbId(scene.foreignId);
    const currentServer = this.currentServer;
    if (!stashDbId || !currentServer) return;

    try {
      await this.processAdult(stashDbId, {
        serviceId: currentServer.id,
        externalServiceId: scene.id,
        externalServiceSlug: scene.title,
        title: scene.title,
        hasFile: scene.hasFile,
        processing: scene.monitored && !scene.hasFile,
        mutationGuard: (callback) =>
          runWithServarrServiceSnapshot('whisparr', currentServer, callback),
      });
    } catch (error) {
      this.scanHadProcessingErrors = true;
      this.log('Failed to process Whisparr scene', 'error', {
        serviceId: currentServer.id,
        sceneId: scene.id,
        stashDbId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const whisparrScanner = new WhisparrScanner();
