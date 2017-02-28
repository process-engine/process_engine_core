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
    }
    proceed(context, newData, source) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.participant !== source.id) {
            }
            const processToken = yield this.getProcessToken();
            const tokenData = processToken.data || {};
            tokenData.current = newData;
            processToken.data = tokenData;
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            yield processToken.save(internalContext);
            yield this.changeState(context, 'end', this);
        });
    }
}
exports.UserTaskEntity = UserTaskEntity;

//# sourceMappingURL=user_task.js.map
