"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timestampName = void 0;
const timestampName = (prefix) => {
    const ts = new Date();
    const tsString = ts.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).replace(/,|:/g, '_').replace(' ', '_');
    return `${prefix}_${tsString}`;
};
exports.timestampName = timestampName;
//# sourceMappingURL=utils.js.map