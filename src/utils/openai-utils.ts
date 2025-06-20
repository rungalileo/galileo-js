import { OpenAI } from 'openai';
import { wrapOpenAI } from '../openai';
import { GalileoLogger } from './galileo-logger';

/**
 * Configuration interface for OpenAI client
 */
export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
  maxConcurrentRequests?: number;
}

/**
 * Response interface for completion requests
 */
export interface CompletionResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Manages OpenAI client instances with connection pooling and rate limiting
 */
export class OpenAIClientManager {
  private static instance: OpenAIClientManager;
  private clients: Map<string, OpenAI> = new Map();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private readonly maxConcurrentRequests: number;

  private constructor(config: OpenAIConfig) {
    this.maxConcurrentRequests = config.maxConcurrentRequests || 10;
  }

  /**
   * Get singleton instance of OpenAIClientManager
   */
  public static getInstance(config: OpenAIConfig): OpenAIClientManager {
    if (!OpenAIClientManager.instance) {
      OpenAIClientManager.instance = new OpenAIClientManager(config);
    }
    return OpenAIClientManager.instance;
  }

  /**
   * Get or create an OpenAI client instance
   */
  public getClient(config: OpenAIConfig): OpenAI {
    const key = `${config.apiKey}-${config.organization || 'default'}`;
    if (!this.clients.has(key)) {
      const client = new OpenAI({
        apiKey: config.apiKey,
        organization: config.organization,
        baseURL: config.baseURL,
        maxRetries: config.maxRetries || 3,
        timeout: config.timeout || 30000,
      });
      this.clients.set(key, client);
    }
    return this.clients.get(key)!;
  }

  /**
   * Execute a request with rate limiting
   */
  public async executeRequest<T>(
    request: () => Promise<T>,
    logger?: GalileoLogger
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          this.activeRequests++;
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      if (this.activeRequests < this.maxConcurrentRequests) {
        wrappedRequest();
      } else {
        this.requestQueue.push(wrappedRequest);
      }
    });
  }

  /**
   * Process the request queue
   */
  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }
}

/**
 * Utility functions for OpenAI API
 */
export class OpenAITools {
  /**
   * Create a completion with retries and error handling
   */
  public static async createCompletion(
    client: OpenAI,
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      logger?: GalileoLogger;
    } = {}
  ): Promise<CompletionResponse> {
    const wrappedClient = wrapOpenAI(client, options.logger);
    
    try {
      const response = await wrappedClient.completions.create({
        model: options.model || 'gpt-4',
        prompt,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
      });

      return {
        text: response.choices[0].text,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
      };
    } catch (error) {
      if (options.logger) {
        options.logger.error('OpenAI API Error', { error, prompt });
      }
      throw error;
    }
  }

  /**
   * Create a streaming completion with proper error handling
   */
  public static async createStreamingCompletion(
    client: OpenAI,
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      logger?: GalileoLogger;
      onChunk?: (text: string) => void;
    } = {}
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const wrappedClient = wrapOpenAI(client, options.logger);
    
    try {
      const stream = await wrappedClient.completions.create({
        model: options.model || 'gpt-4',
        prompt,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      });

      return (async function* () {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0].text;
            if (options.onChunk) {
              options.onChunk(text);
            }
            yield text;
          }
        } catch (error) {
          if (options.logger) {
            options.logger.error('Streaming Error', { error, prompt });
          }
          throw error;
        }
      })();
    } catch (error) {
      if (options.logger) {
        options.logger.error('OpenAI API Error', { error, prompt });
      }
      throw error;
    }
  }
} 