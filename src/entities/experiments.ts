import { GalileoApiClient } from '../api-client';
import {
  type ExperimentResponseType,
  type ExperimentUpdateRequest,
  type ExperimentDatasetRequest,
  type RunExperimentWithFunctionOutput,
  type RunExperimentParams,
  type RunExperimentOutput,
  DEFAULT_PROMPT_RUN_SETTINGS
} from '../types/experiment.types';
import type {
  GalileoScorers,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { Metrics } from '../utils/metrics';
import { ExperimentTags } from './experiment-tags';
import type {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';
import { log } from '../wrappers';
import { init, flush, experimentContext } from '../singleton';
import type { ScorerConfig } from '../types/scorer.types';
import type { DatasetRecord } from '../types/dataset.types';
import {
  deserializeInputFromString,
  getDatasetMetadata,
  loadDatasetAndRecords
} from '../utils/datasets';
import type { Project, PromptRunSettings, PromptTemplateType } from '../types';
import { getProjectWithEnvFallbacks } from '../utils/projects';
import type { Dataset } from '../entities/datasets';

/**
 * Entity class for managing experiments.
 * Provides high-level methods for creating, getting, updating, deleting, and querying experiments.
 */
export class Experiments {
  private client: GalileoApiClient | null = null;

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init();
    }
    return this.client;
  }

  /**
   * Gets an experiment by ID or name.
   * @param options - The options for getting an experiment.
   * @param options.projectId - (Optional) The unique identifier of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @param options.id - (Optional) The unique identifier of the experiment.
   * @param options.name - (Optional) The name of the experiment.
   * @returns A promise that resolves to the experiment, or undefined if not found.
   */
  async getExperiment(options: {
    projectId?: string;
    projectName?: string;
    id?: string;
    name?: string;
  }): Promise<ExperimentResponseType | undefined> {
    if (!options.id && !options.name) {
      throw new Error(
        'To fetch an experiment with getExperiment, either id or name must be provided'
      );
    }

    const client = await this.ensureClient();
    await client.init({
      projectScoped: true,
      projectId: options.projectId,
      projectName: options.projectName
    });

    if (options.id) {
      return await client.getExperiment(options.id);
    }

    const experiments = await client.getExperiments();
    return experiments.find((experiment) => experiment.name === options.name);
  }

  /**
   * Creates a new experiment.
   * @param options - The options for creating an experiment.
   * @param options.name - The name of the experiment.
   * @param options.projectId - (Optional) The unique identifier of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @param options.dataset - (Optional) The dataset configuration.
   * @param options.metrics - (Optional) List of server-side metrics to configure for the experiment.
   * @returns A promise that resolves to the created experiment.
   */
  async createExperiment(options: {
    name: string;
    projectId?: string;
    projectName?: string;
    dataset?: ExperimentDatasetRequest | null;
    metrics?: (GalileoScorers | string | Metric | LocalMetricConfig)[];
  }): Promise<ExperimentResponseType> {
    if (!options.name) {
      throw new Error(
        'A valid `name` must be provided to create an experiment'
      );
    }

    const client = await this.ensureClient();
    await client.init({
      projectScoped: true,
      projectId: options.projectId,
      projectName: options.projectName
    });

    const experiment = await client.createExperiment(
      options.name,
      options.dataset
    );

    // Configure metrics if provided
    if (options.metrics && options.metrics.length > 0) {
      const metricsInstance = new Metrics();
      await metricsInstance.createMetricConfigs(
        client.projectId,
        experiment.id,
        options.metrics
      );
    }

    return experiment;
  }

  /**
   * Updates an experiment.
   * @param options - The options for updating an experiment.
   * @param options.id - The unique identifier of the experiment.
   * @param options.projectId - The unique identifier of the project.
   * @param options.updateRequest - The experiment update request.
   * @returns A promise that resolves to the updated experiment.
   */
  async updateExperiment(options: {
    id: string;
    projectId: string;
    updateRequest: ExperimentUpdateRequest;
  }): Promise<ExperimentResponseType> {
    const client = await this.ensureClient();
    await client.init({ projectId: options.projectId });
    return await client.updateExperiment(options.id, options.updateRequest);
  }

  /**
   * Deletes an experiment.
   * @param options - The options for deleting an experiment.
   * @param options.id - The unique identifier of the experiment.
   * @param options.projectId - The unique identifier of the project.
   * @returns A promise that resolves when the experiment is deleted.
   */
  async deleteExperiment(options: {
    id: string;
    projectId: string;
  }): Promise<void> {
    const client = await this.ensureClient();
    await client.init({ projectId: options.projectId });
    return await client.deleteExperiment(options.id);
  }

  /**
   * Gets experiments for a project.
   * @param options - (Optional) The options for getting experiments.
   * @param options.projectId - (Optional) The unique identifier of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @returns A promise that resolves to an array of experiments.
   */
  async getExperiments(options?: {
    projectId?: string;
    projectName?: string;
  }): Promise<ExperimentResponseType[]> {
    const client = await this.ensureClient();
    await client.init({
      projectScoped: true,
      projectId: options?.projectId,
      projectName: options?.projectName
    });

    return await client.getExperiments();
  }

  /**
   * Processes a dataset row using a runner function.
   * @param row - The dataset row to process.
   * @param processFn - The runner function to use for processing.
   * @returns A promise that resolves to the processed output as a string.
   */
  private async processRow<T extends Record<string, unknown>>(
    row: DatasetRecord,
    processFn: (
      input: T,
      metadata?: Record<string, unknown>
    ) => Promise<unknown>
  ): Promise<string> {
    console.log(`Processing dataset row: ${JSON.stringify(row)}`);

    let output: string = '';

    try {
      // Process the row with logging
      const result = await processFn(
        deserializeInputFromString(row.input) as T,
        row.metadata
      );
      output = JSON.stringify(result);
    } catch (error) {
      console.error(`Error processing dataset row:`, row, error);
      output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return output;
  }

  /**
   * Gets the link to experiment results.
   * @param experimentId - The unique identifier of the experiment.
   * @param projectId - The unique identifier of the project.
   * @returns The URL to the experiment results.
   */
  private getLinkToExperimentResults(
    experimentId: string,
    projectId: string
  ): string {
    let baseUrl = process.env.GALILEO_CONSOLE_URL || 'https://app.galileo.ai';
    if (baseUrl.includes('api.galileo.ai')) {
      baseUrl = baseUrl.replace('api.galileo.ai', 'app.galileo.ai');
    }
    return `${baseUrl}/project/${projectId}/experiments/${experimentId}`;
  }

  /**
   * Runs an experiment by processing each row of a dataset using a runner function.
   * @param experiment - The experiment to run.
   * @param projectName - The name of the project.
   * @param dataset - The content of the dataset.
   * @param processFn - The runner function to use for processing.
   * @param localMetrics - (Optional) The local metrics to use for client-side evaluation.
   * @param projectId - (Optional) The unique identifier of the project. If not provided, a dummy value will be used for link generation.
   * @returns A promise that resolves to the experiment run output.
   */
  async runExperimentWithFunction<T extends Record<string, unknown>>(
    experiment: ExperimentResponseType,
    projectName: string,
    dataset: DatasetRecord[],
    processFn: (
      input: T,
      metadata?: Record<string, unknown>
    ) => Promise<unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    localMetrics: LocalMetricConfig[] = [],
    projectId?: string
  ): Promise<RunExperimentWithFunctionOutput> {
    // Use provided projectId or generate dummy value
    const effectiveProjectId = projectId || 'unknown';

    // Wrap the entire experiment execution in async context
    // This ensures all logger calls within this execution automatically use the experimentId
    return await experimentContext.run(
      {
        experimentId: experiment.id,
        projectName: projectName
      },
      async () => {
        const outputs: string[] = [];

        // Initialize the singleton logger with local metrics
        init({
          experimentId: experiment.id,
          projectName: projectName,
          localMetrics: localMetrics
        });

        // Process each row in the dataset
        for (const row of dataset) {
          const loggedProcessFn = log(
            {
              name: experiment.name ?? 'Unnamed Experiment',
              datasetRecord: row
            },
            processFn
          );
          const output = await this.processRow(row, loggedProcessFn);
          outputs.push(output);
        }

        // Flush the logger
        await flush({ projectName, experimentId: experiment.id });
        console.log(
          `${outputs.length} rows processed for ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'}.`
        );

        // Generate link and message (matching Python)
        const link = this.getLinkToExperimentResults(
          experiment.id,
          effectiveProjectId
        );
        const message = `Experiment ${experiment.name ?? 'Unnamed Experiment'} has completed and results are available at ${link}`;
        console.log(message);

        return {
          experiment,
          link,
          message,
          results: outputs // Keep results for internal use
        };
      }
    );
  }

  /**
   * Runs an experiment by processing each row of a dataset through a specified function or prompt template.
   * If metrics are provided, they will be used to evaluate the experiment.
   * @param params - The experiment run parameters.
   * @param params.name - The name of the experiment.
   * @param params.function - The function to process each dataset row. Either function or promptTemplate must be provided.
   * @param params.promptTemplate - The prompt template to use. Either function or promptTemplate must be provided.
   * @param params.dataset - The dataset to process. Either dataset, datasetId, or datasetName must be provided.
   * @param params.datasetId - The id of the dataset to process. Either dataset, datasetId, or datasetName must be provided.
   * @param params.datasetName - The name of the dataset to process. Either dataset, datasetId, or datasetName must be provided.
   * @param params.metrics - (Optional) List of metrics to evaluate the experiment.
   * @param params.projectName - (Optional) The name of the project.
   * @param params.projectId - (Optional) The id of the project.
   * @param params.experimentTags - (Optional) Tags to associate with the experiment.
   * @param params.promptSettings - (Optional) Settings for prompt template execution.
   * @returns A promise that resolves to the experiment run output.
   */
  async runExperiment<T extends Record<string, unknown>>(
    params: RunExperimentParams<T>
  ): Promise<RunExperimentOutput> {
    const { name, metrics, projectName, projectId } = params;
    const isFunction = 'function' in params;
    const isPromptTemplate = 'promptTemplate' in params;

    if (!isFunction && !isPromptTemplate) {
      throw new Error(
        'Experiment not properly configured for either function or prompt template processing.'
      );
    }

    // Validate array of records cannot be used with prompt templates
    if (
      'dataset' in params &&
      Array.isArray(params.dataset) &&
      isPromptTemplate
    ) {
      throw new Error(
        'Prompt template experiments cannot be run with a local dataset'
      );
    }

    console.log(`Preparing to run experiment '${name}'...`);

    const project = await this.getExperimentProject(projectName, projectId);
    if (!project.name) {
      throw new Error(
        `Experiment ${name} could not be created, project name is required but not available.`
      );
    }

    const experimentName = await this.validateExperimentName(
      name,
      project.name
    );
    const experiment = await this.createNewExperiment(
      params,
      experimentName,
      project.name
    );
    console.log(`🚀 Experiment ${experimentName} created.`);

    await this.configureExperimentTags(
      params.experimentTags,
      project.id,
      experiment.id
    );
    const [scorerConfigs, localMetricConfigs] =
      await this.configureExperimentMetrics(metrics, project.id, experiment.id);

    // Validate local metrics usage
    if (localMetricConfigs.length > 0 && isPromptTemplate) {
      throw new Error(
        'Local metrics can only be used with a locally run experiment (function-based), not a prompt template experiment.'
      );
    }

    console.log('Retrieving the dataset...');

    // Load dataset and records using centralized function
    const [loadedDatasetObj, records] = await this.loadExperimentData(
      params,
      project.name
    );

    // Process using either a runner function or a prompt template
    if (isFunction) {
      return await this.processExperimentFunction(
        params.function,
        experiment,
        project.name,
        project.id,
        records,
        localMetricConfigs,
        scorerConfigs.length
      );
    } else if (isPromptTemplate) {
      return await this.processExperimentPromptTemplate(
        params.promptTemplate,
        params.promptSettings || DEFAULT_PROMPT_RUN_SETTINGS,
        loadedDatasetObj,
        scorerConfigs,
        experiment,
        project.name,
        project.id
      );
    } else {
      throw new Error('One of function or promptTemplate must be provided');
    }
  }

  private async getExperimentProject(
    projectName?: string,
    projectId?: string
  ): Promise<Project> {
    try {
      const project = await getProjectWithEnvFallbacks({
        name: projectName,
        projectId
      });

      return project;
    } catch (error) {
      throw new Error(
        "Exactly one of 'projectId' or 'projectName' must be provided, or set in the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT"
      );
    }
  }

  private async validateExperimentName(
    experimentName: string,
    projectName: string
  ): Promise<string> {
    const experiment = await this.getExperiment({
      name: experimentName,
      projectName
    });
    if (experiment) {
      console.warn(
        `Experiment with name '${experimentName}' already exists, adding a timestamp`
      );

      const timestamp = new Date()
        .toISOString()
        .replace('T', ' at ')
        .replace('Z', '');
      return `${experimentName} ${timestamp}`;
    }

    return experimentName;
  }

  private async createNewExperiment<T extends Record<string, unknown>>(
    params: RunExperimentParams<T>,
    experimentName: string,
    projectName: string
  ): Promise<ExperimentResponseType> {
    const datasetObj = await getDatasetMetadata(params, projectName);
    const datasetRequest: ExperimentDatasetRequest | undefined = datasetObj
      ? {
          datasetId: datasetObj.id,
          versionIndex: datasetObj.currentVersionIndex
        }
      : undefined;

    const experiment = await this.createExperiment({
      name: experimentName,
      projectName,
      dataset: datasetRequest
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentName} could not be created`);
    }

    return experiment;
  }

  private async configureExperimentTags(
    experimentTags: Record<string, string> | undefined,
    projectId: string,
    experimentId: string
  ): Promise<void> {
    if (experimentTags) {
      const experimentTagsService = new ExperimentTags();
      for (const [key, value] of Object.entries(experimentTags)) {
        try {
          await experimentTagsService.upsertExperimentTag({
            projectId,
            experimentId,
            key,
            value,
            tagType: 'generic'
          });
          console.debug(
            `Added tag ${key}=${value} to experiment ${experimentId}`
          );
        } catch (e) {
          console.warn(
            `Failed to add tag ${key}=${value} to experiment ${experimentId}: ${e}`
          );
          // Continue with other tags even if one fails (matches Python behavior)
        }
      }
    }
  }

  private async configureExperimentMetrics(
    metrics:
      | (GalileoScorers | string | Metric | LocalMetricConfig)[]
      | undefined,
    projectId: string,
    experimentId: string
  ): Promise<[ScorerConfig[], LocalMetricConfig[]]> {
    let scorerConfigs: ScorerConfig[] = [];
    let localMetricConfigs: LocalMetricConfig[] = [];
    if (metrics && metrics.length > 0) {
      console.log('Retrieving metrics...');
      const metricsInstance = new Metrics();
      [scorerConfigs, localMetricConfigs] =
        await metricsInstance.createMetricConfigs(
          projectId,
          experimentId,
          metrics
        );
    }

    return [scorerConfigs, localMetricConfigs];
  }

  private async loadExperimentData<T extends Record<string, unknown>>(
    params: RunExperimentParams<T>,
    projectName: string
  ): Promise<[Dataset | null, DatasetRecord[]]> {
    const [loadedDatasetObj, records] = await loadDatasetAndRecords({
      dataset: 'dataset' in params ? params.dataset : undefined,
      datasetId: 'datasetId' in params ? params.datasetId : undefined,
      datasetName: 'datasetName' in params ? params.datasetName : undefined,
      projectName
    });

    // Validate records exist for function-based experiments
    if ('function' in params && (!records || records.length === 0)) {
      throw new Error(
        'A dataset (records, id, or name) must be provided for the experiment.'
      );
    }

    // Validate datasetObj exists for prompt template experiments
    if ('promptTemplate' in params && !loadedDatasetObj) {
      throw new Error(
        'A dataset record, id, or name of a dataset must be provided when a prompt_template is used'
      );
    }

    return [loadedDatasetObj, records];
  }

  private async processExperimentFunction<T extends Record<string, unknown>>(
    processFn: (
      input: T,
      metadata?: Record<string, unknown>
    ) => Promise<unknown>,
    experiment: ExperimentResponseType,
    projectName: string,
    projectId: string,
    records: DatasetRecord[],
    localMetricConfigs: LocalMetricConfig[],
    scorerConfigsLength: number
  ): Promise<RunExperimentWithFunctionOutput> {
    console.log(
      `Processing runner function ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'} for project ${projectName}...`
    );

    const functionResult = await this.runExperimentWithFunction(
      experiment,
      projectName,
      records,
      processFn,
      localMetricConfigs,
      projectId
    );

    if (scorerConfigsLength > 0) {
      console.log(
        `Metrics are still being calculated for runner function ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'}. Results will be available at ${functionResult.link}`
      );
    } else {
      console.log(
        `Runner function ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'} is complete. Results are available at ${functionResult.link}`
      );
    }

    return {
      results: functionResult.results,
      experiment: functionResult.experiment,
      link: functionResult.link,
      message: functionResult.message
    };
  }

  private async processExperimentPromptTemplate(
    promptTemplate: PromptTemplateType,
    promptSettings: PromptRunSettings | undefined,
    loadedDatasetObj: Dataset | null,
    scorerConfigs: ScorerConfig[],
    experiment: ExperimentResponseType,
    projectName: string,
    projectId: string
  ): Promise<RunExperimentOutput> {
    const client = await this.ensureClient();
    await client.init({ projectScoped: true, projectName });

    let promptTemplateVersionId: string | undefined;
    if ('version' in promptTemplate) {
      promptTemplateVersionId = (promptTemplate as PromptTemplateVersion).id;
    } else {
      console.log(
        `Defaulting to the selected version for prompt template ${promptTemplate.name}`
      );
      promptTemplateVersionId = (promptTemplate as PromptTemplate)
        .selectedVersionId;
    }
    client.experimentId = experiment.id;

    console.log(
      `Starting prompt experiment ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'} for project ${projectName}...`
    );

    const response = await client.createPromptRunJob(
      experiment.id,
      projectId,
      promptTemplateVersionId,
      loadedDatasetObj!.id,
      scorerConfigs,
      promptSettings
    );

    const linkToResults = this.getLinkToExperimentResults(
      experiment.id,
      projectId
    );
    console.log(
      `Prompt experiment ${experiment.name ? `experiment ${experiment.name}` : 'unnamed experiment'} has started and is currently processing. Results will be available at ${linkToResults}`
    );

    return { experiment, link: linkToResults, message: response.message };
  }
}
