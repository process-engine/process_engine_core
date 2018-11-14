'use strict';

const BpmnModelParser = require('./dist/commonjs/index').BpmnModelParser;

const {
  ScriptTaskHandler, 
  StartEventHandler, 
  ExclusiveGatewayHandler, 
  ParallelGatewayHandler,
  ServiceTaskHandler, 
  ErrorBoundaryEventHandler,
  MessageBoundaryEventHandler,
  SignalBoundaryEventHandler, 
  TimerBoundaryEventHandler, 
  EndEventHandler,
  CallActivityHandler,
  SubProcessHandler, 
  UserTaskHandler, 
  ManualTaskHandler,
  SendTaskHandler,
  ReceiveTaskHandler,
} = require('./dist/commonjs/index');

const {
  IntermediateCatchEventHandler,
  IntermediateThrowEventHandler,
  IntermediateMessageCatchEventHandler,
  IntermediateMessageThrowEventHandler,
  IntermediateSignalCatchEventHandler,
  IntermediateSignalThrowEventHandler,
  IntermediateTimerCatchEventHandler,
} = require('./dist/commonjs/index');

const {
  CorrelationService,
  FlowNodeInstanceService,
  ProcessModelService,
} = require('./dist/commonjs/index');

const {ExecuteProcessService} = require('./dist/commonjs/index');

const {
  FlowNodeHandlerFactory,
  ProcessModelFacadeFactory,
  ProcessTokenFacadeFactory,
  TimerFacade,
} = require('./dist/commonjs/index');

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
  .dependencies('CorrelationService', 'ExternalTaskRepository', 'FlowNodeInstanceService', 'IamService', 'ProcessModelService');

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

  container.register('SendTaskHandler', SendTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ReceiveTaskHandler', ReceiveTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');

  container.register('ManualTaskHandler', ManualTaskHandler)
    .dependencies('EventAggregator', 'FlowNodeInstanceService', 'LoggingApiService', 'MetricsApiService');
}

module.exports.registerInContainer = registerInContainer;
