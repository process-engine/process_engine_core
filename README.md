# ProcessEngineCore

The `ProcessEngineCore` package handles the parsing, execution and storage
of `ProcessModels`.

It consists of two main namespaces:
- `Model` - handles the parsing of ProcessModels
- `Runtime` - handles the execution and storage of ProcessModels

## Model

This namespace contains the `BpmnModelParser`, which implements the
`IModelParser` interface from the `@process-engine/process_engine_contracts`
package.

It is used for reading the raw XML of a BPMN file and converting it into
a JSON-based object structure, which can be interpreted by the ProcessEngine.

To make it easier to understand, the Parser is divided into several smaller
parsers, each designed to parse a certain part of the BPMNs raw xml.

## Runtime

The runtime namespace contains the entire logic necessary for executing and
storing ProcessModels.

It contains numerous services, handlers and facades to accomplish this task.
The most important ones will now be explained.

### ExecuteProcessService

Whenever you want to start a new instance for a ProcessModel,
this is the service you will need.

It contains the entire operative necessary for handling a Process instances'
execution.

You can start a Process instance by simply calling its `start` method.
This method wraps the entire process execution in a Promise, so if you do not
want your application to wait until the process is finished, you must not `await`
this Promise.

### FlowNodeHandlers

Each BPMN-type has its own handler.
These handlers are named after the respective type they are supposed to handle
and are derived from the `FlowNodeHandler` base class.

The `ExecuteProcessService` will delegate the execution of each FlowNode instance
to a matching `FlowNodeHandler`.
For example, a `ScriptTask` will be run by the `ScriptTaskHandler`,
a `ServiceTask` by the `ServiceTaskHandler`, etc.

Mapping each BPMN type to a handler is done by the `FlowNodeHandlerFactory`.

### FlowNodeHandlerFactory

The factory maps the various BPMN-types to their respective handlers.

It also creates handlers for any BoundaryEvent that may be attached to the
FlowNode.

These additional handlers are attached to their parent handler by decorators.

Example:

Lets say we have a `ScriptTask` with two BoundaryEvents attached to it:
* a `TimerBoundaryEvent`
* an `ErrorBoundaryEvent`

In this scenario, three handlers will be created.
Calling `execute` on the returned handler will produce the following call stack:

* TimerBoundaryEventHandler.execute
  * ErrorBoundaryEventHandler.execute
    * ScriptTaskHandler.execute

The order in which the BoundaryEvent-handlers are chained to the original handler
is also important.

In this case, the `TimerBoundaryEventHandler` has to start its timers as fast
as possible.

If the ScriptTask encounters an error, the `ErrorBoundaryEventHandler` must have
the ability to handle it and decide which FlowNode to execute next.

On the other hand, the `ErrorBoundaryEventHandler` would not want to handle an
error that is related to the `TimerBoundaryEvent`.

The factory is build to prevent such conflicts.
It does this, by making sure that each decorator is run *before* the actual
FlowNode is executed.

### FlowNodeHandler

The `FlowNodeHandler` is the base class for all handlers.
It provides an abstract `executeInternally`-method, where the derived handlers
can implement their logic.

The base class also offers a private hook `afterExecute` that is executed after
each FlowNode instance has finished.

It can be used to perform tasks like saving the progress for a Process or
exporting metrics, in short: Things common to all FlowNode instances.

### ProcessTokenFacade

The `ProcessTokenFacade` manages the `ProcessToken` for the process that is
currently being run.
It allows each FlowNodeInstance to query information from the ProcessToken that
is relevant for its specific UseCase.

This guarantees that each FlowNode instance only gets the information that it
actually needs, instead of the entire `ProcessToken` history.

It performs the following tasks:
* store each FlowNode instance result, using the `addResultForFlowNode` method
* split ProcessTokens, using `getProcessTokenFacadeForParallelBranch`
* merge several ProcessTokens together, using `mergeTokenHistory`
* For backwards compatibility:
  * get a ProcessToken in the old format, using `getOldTokenFormat`.
  This will provide you with a structure that resembles the old
  `token.current`/`token.history` structure.

### ProcessModelFacade

The `ProcessModelFacade` provides access to the elements of a given ProcessModel.
These elements can be FlowNodes, SequenceFlows or any other object that is
contained within the ProcessModel.

A FlowNode instance, for example, can use this Facade to determine the FlowNode
that is to be executed next.
Or a Split-Gateway can use it to find its corresponding Join-Gateway.

#### SubProcessModelFacade

The `SubProcessModelFacade` provides access to the elements of a given
SubProcess.
It is created, using the parent process' `ProcessModelFacade`.
This allows the SubProcess to access its parent ProcessModel as well.

The `SubProcessModelFacade` implements the same `IProcessModelFacade` interface
as the `ProcessModelFacade`.
This allows for the `SubProcessModelFacade` to be be passed through to the
handlers, without them knowing they're executed inside a SubProcess.
