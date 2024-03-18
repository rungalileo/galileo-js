"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionLoggingMethod = exports.TransactionRecordType = void 0;
var TransactionRecordType;
(function (TransactionRecordType) {
    TransactionRecordType["llm"] = "llm";
    TransactionRecordType["chat"] = "chat";
    TransactionRecordType["chain"] = "chain";
    TransactionRecordType["tool"] = "tool";
    TransactionRecordType["agent"] = "agent";
    TransactionRecordType["retriever"] = "retriever";
})(TransactionRecordType || (exports.TransactionRecordType = TransactionRecordType = {}));
var TransactionLoggingMethod;
(function (TransactionLoggingMethod) {
    TransactionLoggingMethod["js_langchain"] = "js_langchain";
    TransactionLoggingMethod["js_logger"] = "js_logger";
})(TransactionLoggingMethod || (exports.TransactionLoggingMethod = TransactionLoggingMethod = {}));
//# sourceMappingURL=transaction.types.js.map