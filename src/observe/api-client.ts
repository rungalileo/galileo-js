import { GalileoApiClient, ProjectTypes, RequestMethod } from "../api-client";
import { Routes } from "../types/routes.types";
import { TransactionRecordBatch } from "../types/observe/transaction.types";

export default class GalileoObserveApiClient extends GalileoApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.observe;
  }

  // TODO: This should have a more accurate return type
  public async getLoggedData(
    start_time: string,
    end_time: string,
    filters: Array<any> = [],
    sort_spec: Array<any> = [],
    limit?: number,
    offset?: number,
    include_chains?: boolean,
    chain_id?: string
  ): Promise<Record<string, unknown>> {

    return await this.makeRequest<Record<string, unknown>>(
      RequestMethod.POST,
      Routes.rows,
      {
        filters,
        sort_spec
      },
      {
        start_time,
        end_time,
        chain_id,
        limit,
        offset,
        include_chains
      }
    );
  }

  // TODO: This should have a more accurate return type
  public async getMetrics(
    start_time: string,
    end_time: string,
    filters: Array<any> = [],
    interval?: number,
    group_by?: string
  ): Promise<Record<string, unknown>> {
    return await this.makeRequest<Record<string, unknown>>(
      RequestMethod.POST,
      Routes.metrics,
      {
        filters
      },
      {
        start_time,
        end_time,
        interval,
        group_by
      }
    );
  }

  // TODO: This should have a more accurate return type
  public async deleteLoggedData(filters: Array<any> = []): Promise<Record<string, unknown>> {
    return await this.makeRequest<Record<string, unknown>>(
      RequestMethod.POST,
      Routes.delete,
      {
        filters
      }
    );
  }

  public async ingestBatch(
    transaction_batch: TransactionRecordBatch
  ): Promise<string> {
    return await this.makeRequest<string>(
      RequestMethod.POST,
      Routes.ingest,
      transaction_batch
    );
  }
}