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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalileoObserveCallback = void 0;
var base_1 = require("@langchain/core/callbacks/base");
var api_client_1 = require("./api-client");
var GalileoObserveCallback = /** @class */ (function (_super) {
    __extends(GalileoObserveCallback, _super);
    function GalileoObserveCallback(project_name) {
        var _this = _super.call(this) || this;
        _this.name = 'GalileoObserveCallback';
        _this.api_client = new api_client_1.ApiClient();
        _this.api_client.init(project_name);
        return _this;
    }
    return GalileoObserveCallback;
}(base_1.BaseCallbackHandler));
exports.GalileoObserveCallback = GalileoObserveCallback;
