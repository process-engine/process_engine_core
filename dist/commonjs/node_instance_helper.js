"use strict";
var NodeInstanceHelper = (function () {
    function NodeInstanceHelper(datastoreService, messagebusService, iamService) {
        this._datastoreService = undefined;
        this._messagebusService = undefined;
        this._iamService = undefined;
        this._datastoreService = datastoreService;
        this._messagebusService = messagebusService;
        this._iamService = iamService;
    }
    Object.defineProperty(NodeInstanceHelper.prototype, "datastoreService", {
        get: function () {
            return this._datastoreService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceHelper.prototype, "messagebusService", {
        get: function () {
            return this._messagebusService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceHelper.prototype, "iamService", {
        get: function () {
            return this._iamService;
        },
        enumerable: true,
        configurable: true
    });
    return NodeInstanceHelper;
}());
exports.NodeInstanceHelper = NodeInstanceHelper;
;

//# sourceMappingURL=node_instance_helper.js.map
