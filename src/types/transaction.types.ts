export enum TransactionRecordType {
  llm = 'llm',
  chat = 'chat',
  chain = 'chain',
  tool = 'tool',
  agent = 'agent',
  retriever = 'retriever',
  workflow = 'workflow'
}

export enum TransactionLoggingMethod {
  js_langchain = 'js_langchain',
  js_logger = 'js_logger'
}

export interface TransactionRecord {
  latency_ms?: number;
  status_code?: number;
  input_text: string;
  output_text?: string;
  model?: string;
  num_input_tokens?: number;
  num_output_tokens?: number;
  num_total_tokens?: number;
  finish_reason?: string;
  node_id: string;
  chain_id?: string;
  chain_root_id?: string;
  output_logprobs?: Record<string, any>;
  created_at: string;
  tags?: string[];
  user_metadata?: Record<string, any>;
  temperature?: number;
  constructor?: string;
  node_type: TransactionRecordType;
  has_children: boolean;
  version?: string;
}

export interface TransactionRecordBatch {
  records: TransactionRecord[];
  logging_method: TransactionLoggingMethod;
  client_version?: string;
}
