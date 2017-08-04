'use strict';

module.exports.BpmnDiagram = require('./BpmnDiagram.json');
module.exports.ProcessEngineService = require('./ProcessEngineService.json');
module.exports.NodeDefEntity = require('./NodeDefEntity.json');
module.exports.ProcessDefEntity = require('./ProcessDefEntity.json');
module.exports.FlowDefEntity = require('./FlowDefEntity.json');
module.exports.LaneEntity = require('./LaneEntity.json');
module.exports.NodeInstanceEntityDependencyHelper = require('./NodeInstanceEntityDependencyHelper.json');
module.exports.NodeInstanceEntity = require('./NodeInstanceEntity.json');
module.exports.EventEntity = require('./EventEntity.json');
module.exports.EndEventEntity = require('./EndEventEntity.json');
module.exports.ExclusiveGatewayEntity = require('./ExclusiveGatewayEntity.json');
module.exports.ParallelGatewayEntity = require('./ParallelGatewayEntity.json');
module.exports.ProcessEntity = require('./ProcessEntity.json');
module.exports.ScriptTaskEntity = require('./ScriptTaskEntity.json');
module.exports.ServiceTaskEntity = require('./ServiceTaskEntity.json');
module.exports.StartEventEntity = require('./StartEventEntity.json');
module.exports.UserTaskEntity = require('./UserTaskEntity.json');
module.exports.ProcessTokenEntity = require('./ProcessTokenEntity.json');
module.exports.BoundaryEventEntity = require('./BoundaryEventEntity.json');
module.exports.SubprocessExternalEntity = require('./SubprocessExternalEntity.json');
module.exports.SubprocessInternalEntity = require('./SubprocessInternalEntity.json');
module.exports.ThrowEventEntity = require('./ThrowEventEntity.json');
module.exports.CatchEventEntity = require('./CatchEventEntity.json');
module.exports.ProcessDefEntityTypeService = require('./ProcessDefEntityTypeService.json');
module.exports.NodeInstanceEntityTypeService = require('./NodeInstanceEntityTypeService.json');
module.exports._heritage = {
  "ProcessEngineService": [
    "IProcessEngineService"
  ],
  "NodeDefEntity": [
    "Entity",
    "INodeDefEntity"
  ],
  "ProcessDefEntity": [
    "Entity",
    "IProcessDefEntity"
  ],
  "FlowDefEntity": [
    "Entity",
    "IFlowDefEntity"
  ],
  "LaneEntity": [
    "Entity",
    "ILaneEntity"
  ],
  "EndEventEntity": [
    "EventEntity",
    "IEndEventEntity"
  ],
  "ExclusiveGatewayEntity": [
    "NodeInstanceEntity",
    "IExclusiveGatewayEntity"
  ],
  "NodeInstanceEntity": [
    "Entity",
    "INodeInstanceEntity"
  ],
  "ParallelGatewayEntity": [
    "NodeInstanceEntity",
    "IParallelGatewayEntity"
  ],
  "ProcessEntity": [
    "Entity",
    "IProcessEntity"
  ],
  "ScriptTaskEntity": [
    "NodeInstanceEntity",
    "IScriptTaskEntity"
  ],
  "ServiceTaskEntity": [
    "NodeInstanceEntity",
    "IServiceTaskEntity"
  ],
  "StartEventEntity": [
    "EventEntity",
    "IStartEventEntity"
  ],
  "UserTaskEntity": [
    "NodeInstanceEntity",
    "IUserTaskEntity"
  ],
  "EventEntity": [
    "NodeInstanceEntity",
    "IEventEntity"
  ],
  "ProcessTokenEntity": [
    "Entity",
    "IProcessTokenEntity"
  ],
  "BoundaryEventEntity": [
    "EventEntity",
    "IBoundaryEventEntity"
  ],
  "SubprocessExternalEntity": [
    "NodeInstanceEntity",
    "ISubprocessExternalEntity"
  ],
  "SubprocessInternalEntity": [
    "NodeInstanceEntity",
    "ISubprocessInternalEntity"
  ],
  "ThrowEventEntity": [
    "EventEntity",
    "IThrowEventEntity"
  ],
  "CatchEventEntity": [
    "EventEntity",
    "ICatchEventEntity"
  ],
  "ProcessDefEntityTypeService": [
    "IProcessDefEntityTypeService"
  ],
  "NodeInstanceEntityTypeService": [
    "INodeInstanceEntityTypeService"
  ],
  "BpmnDiagram": [
    "IBpmnDiagram"
  ]
};
