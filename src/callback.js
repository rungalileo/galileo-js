"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalileoObserveCallback = void 0;
var base_1 = require("@langchain/core/callbacks/base");
var api_client_js_1 = require("./api-client.js");
var GalileoObserveCallback = /** @class */ (function (_super) {
    __extends(GalileoObserveCallback, _super);
    function GalileoObserveCallback(project_name, version) {
        if (version === void 0) { version = null; }
        var _this = _super.call(this) || this;
        _this.name = 'GalileoObserveCallback';
        _this.timers = {};
        _this.records = {};
        _this.version = version;
        _this.api_client = new api_client_js_1.ApiClient();
        _this.api_client.init(project_name);
        return _this;
    }
    GalileoObserveCallback.prototype._start_new_node = function (run_id, parent_run_id) {
        return __awaiter(this, void 0, void 0, function () {
            var node_id, chain_id, chain_root_id;
            return __generator(this, function (_a) {
                node_id = run_id;
                chain_id = parent_run_id ? parent_run_id : null;
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
                return [2 /*return*/, [node_id, chain_root_id, chain_id]];
            });
        });
    };
    GalileoObserveCallback.prototype._end_node = function (run_id) {
        return __awaiter(this, void 0, void 0, function () {
            var node_id, latency_ms;
            return __generator(this, function (_a) {
                node_id = run_id;
                this.timers[node_id]['stop'] = performance.now();
                latency_ms = Math.round((this.timers[node_id]['stop'] - this.timers[node_id]['start']) * 1000);
                delete this.timers[node_id];
                return [2 /*return*/, [node_id, latency_ms]];
            });
        });
    };
    GalileoObserveCallback.prototype._finalize_node = function (record) {
        return __awaiter(this, void 0, void 0, function () {
            var batch_records, _i, _a, _b, k, v, transaction_batch;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        this.records[record.node_id] = record;
                        batch_records = [];
                        if (!(record.node_id === record.chain_root_id)) return [3 /*break*/, 2];
                        for (_i = 0, _a = Object.entries(this.records); _i < _a.length; _i++) {
                            _b = _a[_i], k = _b[0], v = _b[1];
                            if (v.chain_root_id === record.chain_root_id) {
                                batch_records.push(v);
                                delete this.records[k];
                            }
                        }
                        transaction_batch = {
                            records: batch_records
                        };
                        return [4 /*yield*/, this.api_client.ingestBatch(transaction_batch)];
                    case 1:
                        _c.sent();
                        _c.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    return GalileoObserveCallback;
}(base_1.BaseCallbackHandler));
exports.GalileoObserveCallback = GalileoObserveCallback;
