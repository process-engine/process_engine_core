"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
class UserTaskEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            this.state = 'wait';
            yield this.save(null, internalContext);
            const pojo = yield this.toPojo(internalContext);
            const data = {
                action: 'userTask',
                data: pojo
            };
            const origin = this.getEntityReference();
            const meta = {
                jwt: context.encryptedToken
            };
            const msg = this.messageBusService.createMessage(data, origin, meta);
            if (this.participant) {
                yield this.messageBusService.publish('/participant/' + this.participant, msg);
            }
            else {
                const role = yield this.getLaneRole(context);
                yield this.messageBusService.publish('/role/' + role, msg);
            }
        });
    };
    UserTaskEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var internalContext, pojo, data, origin, meta, msg, role;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 1:
                        internalContext = _a.sent();
                        this.state = 'wait';
                        return [4 /*yield*/, this.save(null, internalContext)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.toPojo(internalContext)];
                    case 3:
                        pojo = _a.sent();
                        data = {
                            action: 'userTask',
                            data: pojo
                        };
                        origin = this.getEntityReference();
                        meta = {
                            jwt: context.encryptedToken
                        };
                        msg = this.helper.messagebusService.createMessage(data, origin, meta);
                        if (!this.participant) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.helper.messagebusService.publish('/participant/' + this.participant, msg)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 5: return [4 /*yield*/, this.getLaneRole(context)];
                    case 6:
                        role = _a.sent();
                        return [4 /*yield*/, this.helper.messagebusService.publish('/role/' + role, msg)];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
}
exports.UserTaskEntity = UserTaskEntity;

//# sourceMappingURL=user_task.js.map
