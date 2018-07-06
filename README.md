# Process Engine Execution PoC

## FlowNodeHandlerFactory

Inside the factory, the mapping between types of BPMN-elements and their respective handlers is done.

The factory maps the various bpmn-types to their respective handlers.

It also creates handlers for any BoundaryEvent that may be attached to the FlowNode.
These additional handlers are chained to their parent handler by using decorators.

Example:

The FlowNode is a ScriptTask and there are to BoundaryEvents attached to it:
* a TimerBoundaryEvent
* and an ErrorBoundaryEvent

In this scenario, three handlers will be created.
Calling `execute` on the returned handler will produce the following call stack:

* TimerBoundaryEventHandler.execute
  * ErrorBoundaryEventHandler.execute
    * ScriptTaskHandler.execute

The order in which the BoundaryEvent-handlers are chained to the original handler is also important.

In this case, the TimerBoundaryEvent-handler has to start its timers as fast as possible.

If the ScriptTask encounters an error, the ErrorBoundaryEvent-handler must have the ability to handle it and decide which FlowNode to execute next.
On the other hand, the ErrorBoundaryEvent-handler would not want to handle an error that related to the TimerBoundaryEvent.

The factory is build to prevent such conflicts. However, the original `FlowNodeHandler` (in this case the `ScriptTaskHandler`) will always be called last.

## FlowNodeHandler

The FlowNodeHandler is the base class for all handlers. It provides an abstract `executeInternally`-method for the derived handler to implement its logic.

The base class also offers a private hook `afterExecute` that is executed after each FlowNode execution, that is not exposed to derived classes.
It can be used to perform tasks like saving progress or exporting metrics (things that are done identically for all FlowNodeHandlers).

## ProcessTokenFacade

The `ProcessTokenFacade` identifies and returns any information stored in the `ProcessToken` that we require for our current use case.

This ensures that each `FlowNode` only gets the information that it actually needs, instead of the
entire process token history.

It performs the following tasks:
* store each FlowNode execution result, using the `addResultForFlowNode` method.
* split process tokens, using `getProcessTokenFacadeForParallelBranch`
* merge process tokens, using `mergeTokenHistory`
* For backwards compatibility:
  * get a process token in the old format, using `getOldTokenFormat`
  * evaluate mappers on `FlowNodes` and `SequenceFlows`, using the methods evaluateMapperForFlowNode` or `evaluateMapperForSequenceFlow`

## ProcessModelFacade

The `ProcessModelFacade` provides access to the elements of a given process. These elements can be FlowNodes, SequenceFlows or any other object that is contained in the object model.

### SubProcessModelFacade

The `SubProcessModelFacade` provides access to the elements of a given SubProcess. 
It is created, using the parent processes `ProcessModelFacade`.
This allows the SubProcess to access its parent process.

The SubProcessModelFacade implements the same `IProcessModelFacade` interface as the normal facade, so that it can be passed through to handlers without them knowing they're executed inside a SubProcess.

## ExecutionContextFacade

To get a better understanding of the use cases where we actually use the ExecutionContext, it is also represented by a facade.
