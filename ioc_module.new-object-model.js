'use strict';

const ProcessEngineService = require('./dist/commonjs/index').ProcessEngineService;
const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const ScriptTaskHandler = require('./dist/commonjs/index').ScriptTaskHandler;
const StartEventHandler = require('./dist/commonjs/index').StartEventHandler;
const ExclusiveGatewayHandler = require('./dist/commonjs/index').ExclusiveGatewayHandler;
const ParallelGatewayHandler = require('./dist/commonjs/index').ParallelGatewayHandler;
const ServiceTaskHandler = require('./dist/commonjs/index').ServiceTaskHandler;
const ErrorBoundaryEventHandler = require('./dist/commonjs/index').ErrorBoundaryEventHandler;
const TimerBoundaryEventHandler = require('./dist/commonjs/index').TimerBoundaryEventHandler;
const IntermediateCatchEventHandler = require('./dist/commonjs/index').IntermediateCatchEventHandler;
const IntermediateThrowEventHandler = require('./dist/commonjs/index').IntermediateThrowEventHandler;
const EndEventHandler = require('./dist/commonjs/index').EndEventHandler;

const ProcessEngineStorageService = require('./dist/commonjs/index').ProcessEngineStorageService;
const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;

const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const BpmnProcessEntity = require('./dist/commonjs/index').BpmnProcessEntity;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'DatastoreService', 'MessageBusService');

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('ProcessEngineStorageService', ProcessEngineStorageService)
    .dependencies('DatastoreService', 'IamService')
    .singleton();

  container.register('BpmnProcessEntity', BpmnProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('ScriptTaskHandler', ScriptTaskHandler);

  container.register('StartEventHandler', StartEventHandler);
  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler);
  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory');
  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'Invoker');
  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);
  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimingService', 'EventAggregator', 'IamService');
  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler);
  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler);
  container.register('EndEventHandler', EndEventHandler);

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies('MessageBusService', 'EventAggregator', 'ProcessDefEntityTypeService', 'ExecuteProcessService', 'FeatureService', 'IamService', 'ProcessRepository', 'DatastoreService', 'NodeInstanceEntityTypeService', 'ApplicationService', 'Invoker', 'ProcessEngineStorageService')
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');
}

module.exports.registerInContainer = registerInContainer;
