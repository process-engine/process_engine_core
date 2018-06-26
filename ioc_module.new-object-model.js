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
const CallActivityHandler = require('./dist/commonjs/index').CallActivityHandler;
const SubProcessHandler = require('./dist/commonjs/index').SubProcessHandler;
const UserTaskHandler = require('./dist/commonjs/index').UserTaskHandler;

const ProcessModelPersistence = require('./dist/commonjs/index').ProcessModelPersistence;
const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;
const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;

const FlowNodeInstancePersistence = require('./dist/commonjs/index').FlowNodeInstancePersistence;

const entityDiscoveryTag = require('@essential-projects/core_contracts').EntityDiscoveryTag;
const BpmnProcessEntity = require('./dist/commonjs/index').BpmnProcessEntity;

function registerInContainer(container) {

  container.register('ExecuteProcessService', ExecuteProcessService)
    .dependencies('FlowNodeHandlerFactory', 'MessageBusService', 'EventAggregator');

  container.register('FlowNodeInstancePersistence', FlowNodeInstancePersistence)
    .singleton();

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('ProcessModelPersistence', ProcessModelPersistence)
    .singleton();

  container.register('BpmnProcessEntity', BpmnProcessEntity)
    .tags(entityDiscoveryTag);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstancePersistence');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstancePersistence');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistence');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstancePersistence');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('FlowNodeInstancePersistence');
  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstancePersistence');
  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('FlowNodeHandlerFactory', 'FlowNodeInstancePersistence');
  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'FlowNodeInstancePersistence');
  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler);
  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('TimingService', 'EventAggregator', 'IamService');
  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('FlowNodeInstancePersistence');
  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('FlowNodeInstancePersistence');
  container.register('EndEventHandler', EndEventHandler)
    .dependencies('FlowNodeInstancePersistence', 'EventAggregator');

  container.register('ProcessEngineService', ProcessEngineService)
    .dependencies('MessageBusService', 'EventAggregator', 'ProcessDefEntityTypeService', 'ExecuteProcessService', 'FeatureService', 'IamService', 'ProcessRepository', 'DatastoreService', 'NodeInstanceEntityTypeService', 'ApplicationService', 'Invoker', 'ProcessModelPersistence')
    .injectPromiseLazy('NodeInstanceEntityTypeService')
    .configure('process_engine:process_engine_service')
    .singleton();

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');
}

module.exports.registerInContainer = registerInContainer;
