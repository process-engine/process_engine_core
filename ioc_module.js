'use strict';

const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const ScriptTaskHandler = require('./dist/commonjs/index').ScriptTaskHandler;
const StartEventHandler = require('./dist/commonjs/index').StartEventHandler;
const ExclusiveGatewayHandler = require('./dist/commonjs/index').ExclusiveGatewayHandler;
const ParallelGatewayHandler = require('./dist/commonjs/index').ParallelGatewayHandler;
const ServiceTaskHandler = require('./dist/commonjs/index').ServiceTaskHandler;
const ErrorBoundaryEventHandler = require('./dist/commonjs/index').ErrorBoundaryEventHandler;
const MessageBoundaryEventHandler = require('./dist/commonjs/index').MessageBoundaryEventHandler;
const SignalBoundaryEventHandler = require('./dist/commonjs/index').SignalBoundaryEventHandler;
const TimerBoundaryEventHandler = require('./dist/commonjs/index').TimerBoundaryEventHandler;
const EndEventHandler = require('./dist/commonjs/index').EndEventHandler;
const CallActivityHandler = require('./dist/commonjs/index').CallActivityHandler;
const SubProcessHandler = require('./dist/commonjs/index').SubProcessHandler;
const UserTaskHandler = require('./dist/commonjs/index').UserTaskHandler;

const IntermediateCatchEventHandler = require('./dist/commonjs/index').IntermediateCatchEventHandler;
const IntermediateThrowEventHandler = require('./dist/commonjs/index').IntermediateThrowEventHandler;
const IntermediateMessageCatchEventHandler = require('./dist/commonjs/index').IntermediateMessageCatchEventHandler;
const IntermediateMessageThrowEventHandler = require('./dist/commonjs/index').IntermediateMessageThrowEventHandler;
const IntermediateSignalCatchEventHandler = require('./dist/commonjs/index').IntermediateSignalCatchEventHandler;
const IntermediateSignalThrowEventHandler = require('./dist/commonjs/index').IntermediateSignalThrowEventHandler;
const IntermediateTimerCatchEventHandler = require('./dist/commonjs/index').IntermediateTimerCatchEventHandler;

const CorrelationService = require('./dist/commonjs/index').CorrelationService;
const FlowNodeInstanceService = require('./dist/commonjs/index').FlowNodeInstanceService;
const ProcessModelService = require('./dist/commonjs/index').ProcessModelService;

const DeleteProcessModelService = require('./dist/commonjs/index').DeleteProcessModelService;

const ExecuteProcessService = require('./dist/commonjs/index').ExecuteProcessService;

const FlowNodeHandlerFactory = require('./dist/commonjs/index').FlowNodeHandlerFactory;
const ProcessModelFacadeFactory = require('./dist/commonjs/index').ProcessModelFacadeFactory;
const ProcessTokenFacadeFactory = require('./dist/commonjs/index').ProcessTokenFacadeFactory;
const TimerFacade = require('./dist/commonjs/index').TimerFacade;

function registerInContainer(container) {

  container
    .register('ExecuteProcessService', ExecuteProcessService)
    .dependencies(
      'CorrelationService',
      'EventAggregator',
      'FlowNodeHandlerFactory',
      'FlowNodeInstanceService',
      'LoggingApiService',
      'MetricsApiService',
      'ProcessModelService'
    );

  container.register('CorrelationService', CorrelationService)
    .dependencies('CorrelationRepository', 'FlowNodeInstanceRepository', 'ProcessDefinitionRepository');

  container.register('DeleteProcessModelService', DeleteProcessModelService)
  .dependencies('CorrelationService', 'FlowNodeInstanceService', 'ProcessModelService');

  container.register('FlowNodeInstanceService', FlowNodeInstanceService)
    .dependencies('FlowNodeInstanceRepository', 'IamService');

  container.register('ProcessModelService', ProcessModelService)
    .dependencies('ProcessDefinitionRepository', 'IamService', 'BpmnModelParser');

  container.register('FlowNodeHandlerFactory', FlowNodeHandlerFactory)
    .dependencies('container');

  container.register('ProcessModelFacadeFactory', ProcessModelFacadeFactory)
    .singleton();

  container.register('ProcessTokenFacadeFactory', ProcessTokenFacadeFactory)
    .singleton();

  container.register('TimerFacade', TimerFacade)
    .dependencies('EventAggregator', 'TimerService');

  container.register('BpmnModelParser', BpmnModelParser);

  container.register('CallActivityHandler', CallActivityHandler)
    .dependencies('ConsumerApiService', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('EndEventHandler', EndEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ErrorBoundaryEventHandler', ErrorBoundaryEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ExclusiveGatewayHandler', ExclusiveGatewayHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateCatchEventHandler', IntermediateCatchEventHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateThrowEventHandler', IntermediateThrowEventHandler)
    .dependencies('container', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateMessageCatchEventHandler', IntermediateMessageCatchEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateMessageThrowEventHandler', IntermediateMessageThrowEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateSignalCatchEventHandler', IntermediateSignalCatchEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateSignalThrowEventHandler', IntermediateSignalThrowEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('IntermediateTimerCatchEventHandler', IntermediateTimerCatchEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container.register('MessageBoundaryEventHandler', MessageBoundaryEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ParallelGatewayHandler', ParallelGatewayHandler)
    .dependencies('EventAggregator', 'FlowNodeHandlerFactory', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ScriptTaskHandler', ScriptTaskHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ServiceTaskHandler', ServiceTaskHandler)
    .dependencies('container', 'EventAggregator', 'ExternalTaskRepository', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('SignalBoundaryEventHandler', SignalBoundaryEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('StartEventHandler', StartEventHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container.register('SubProcessHandler', SubProcessHandler)
    .dependencies('EventAggregator', 'FlowNodeHandlerFactory', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('TimerBoundaryEventHandler', TimerBoundaryEventHandler)
    .dependencies('FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService', 'TimerFacade');

  container.register('UserTaskHandler', UserTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');
}

module.exports.registerInContainer = registerInContainer;
