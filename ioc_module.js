'use strict';

const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const ScriptTaskHandler = require('./dist/commonjs/index').ScriptTaskHandler;
const StartEventHandler = require('./dist/commonjs/index').StartEventHandler;
const ExclusiveGatewayHandler = require('./dist/commonjs/index').ExclusiveGatewayHandler;
const ParallelGatewayHandler = require('./dist/commonjs/index').ParallelGatewayHandler;
const ServiceTaskHandler = require('./dist/commonjs/index').ServiceTaskHandler;
const ErrorBoundaryEventHandler = require('./dist/commonjs/index').ErrorBoundaryEventHandler;
const MessageBoundaryEventHandler = require('./dist/commonjs/index').MessageBoundaryEventHandler;
const TimerBoundaryEventHandler = require('./dist/commonjs/index').TimerBoundaryEventHandler;
const EndEventHandler = require('./dist/commonjs/index').EndEventHandler;
const CallActivityHandler = require('./dist/commonjs/index').CallActivityHandler;
const SubProcessHandler = require('./dist/commonjs/index').SubProcessHandler;
const UserTaskHandler = require('./dist/commonjs/index').UserTaskHandler;

const IntermediateCatchEventHandler = require('./dist/commonjs/index').IntermediateCatchEventHandler;
const IntermediateThrowEventHandler = require('./dist/commonjs/index').IntermediateThrowEventHandler;
const IntermediateMessageCatchEventHandler = require('./dist/commonjs/index').IntermediateMessageCatchEventHandler;
const IntermediateMessageThrowEventHandler = require('./dist/commonjs/index').IntermediateMessageThrowEventHandler;

const CorrelationService = require('./dist/commonjs/index').CorrelationService;
const FlowNodeInstanceService = require('./dist/commonjs/index').FlowNodeInstanceService;
const ProcessModelService = require('./dist/commonjs/index').ProcessModelService;

const ImportProcessService = require('./dist/commonjs/index').ImportProcessService;

const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;

const ExecutionContextFacadeFactory = require('./dist/commonjs/index').ExecutionContextFacadeFactory;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstanceService', 'ProcessModelService', 'EventAggregator');

  container.register('CorrelationService', CorrelationService)
    .dependencies('FlowNodeInstanceRepository', 'IamService');

  container.register('FlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies('FlowNodeInstanceRepository', 'IamService');

  container.register('ProcessModelService', ProcessModelService)
    .dependencies('ProcessDefinitionRepository', 'IamService', 'BpmnModelParser');

  container.register('ImportProcessService', ImportProcessService)
    .dependencies('container', 'BpmnModelParser');

  container.register('ExecutionContextFacadeFactory', ExecutionContextFacadeFactory)
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstanceService');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstanceService');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstanceService');

  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstanceService');

  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstanceService');

  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);

  container.register('MessageBoundaryEventHandler', MessageBoundaryEventHandler)
    .dependencies('EventAggregator');

  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimerService', 'EventAggregator');

  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('container');

  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('container');

  container.register('IntermediateMessageCatchEventHandler', IntermediateMessageCatchEventHandler)
    .dependencies('FlowNodeInstanceService', 'EventAggregator');

  container.register('IntermediateMessageThrowEventHandler', IntermediateMessageThrowEventHandler)
    .dependencies('FlowNodeInstanceService', 'EventAggregator');

  container.register('EndEventHandler', EndEventHandler)
    .dependencies('FlowNodeInstanceService', 'EventAggregator');
}

module.exports.registerInContainer = registerInContainer;
