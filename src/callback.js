"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalileoObserveCallback = void 0;
const base_1 = require("@langchain/core/callbacks/base");
const api_client_js_1 = require("./api-client.js");
class GalileoObserveCallback extends base_1.BaseCallbackHandler {
    constructor(project_name, version = null) {
        super();
        this.name = 'GalileoObserveCallback';
        this.timers = {};
        this.records = {};
        this.version = version;
        this.project_name = project_name;
        this.api_client = new api_client_js_1.ApiClient();
    }
    async init() {
        await this.api_client.init(this.project_name);
    }
    async _start_new_node(run_id, parent_run_id) {
        const node_id = run_id;
        const chain_id = parent_run_id ? parent_run_id : null;
        let chain_root_id;
        if (chain_id) {
            // This check ensures we're actually logging the parent chain
            if (this.records[chain_id]) {
                this.records[chain_id].has_children = true;
                chain_root_id = this.records[chain_id].chain_root_id || null;
            }
            else {
                // We're not logging the parent chain, so this is the root
                chain_root_id = node_id;
            }
        }
        else {
            // This node is the root if it doesn't have a parent
            chain_root_id = node_id;
        }
        this.timers[node_id] = {};
        this.timers[node_id]['start'] = performance.now();
        return [node_id, chain_root_id, chain_id];
    }
    async _end_node(run_id) {
        const node_id = run_id;
        this.timers[node_id]['stop'] = performance.now();
        const latency_ms = Math.round((this.timers[node_id]['stop'] - this.timers[node_id]['start']) * 1000);
        delete this.timers[node_id];
        return [node_id, latency_ms];
    }
    async _finalize_node(record) {
        this.records[record.node_id] = record;
        const batch_records = [];
        // If this record is closing out a root chain, then add all
        // records with that chain_root_id to the batch
        if (record.node_id === record.chain_root_id) {
            for (const [k, v] of Object.entries(this.records)) {
                if (v.chain_root_id === record.chain_root_id) {
                    batch_records.push(v);
                    delete this.records[k];
                }
            }
            const transaction_batch = {
                records: batch_records
            };
            await this.api_client.ingestBatch(transaction_batch);
        }
    }
}
exports.GalileoObserveCallback = GalileoObserveCallback;
//# sourceMappingURL=callback.js.map