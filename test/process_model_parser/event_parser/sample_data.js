module.exports.sampleStartEvents = {
  'bpmn:startEvent': [{
    id: 'StartEvent_1',
    name: 'Start',
    'bpmn:outgoing': 'SequenceFlow_0jy2lb2'
  }, {
    id: 'SignalStartEvent_1',
    name: 'Wait for TestSignal',
    'bpmn:outgoing': 'SequenceFlow_115y68b',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'TimerStartEvent_1',
    name: 'A timer based start event',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeCycle': {
        _: '* * * * 1',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'TimerStartEvent_2',
    name: 'Another timer start event',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDate': {
        _: '2019-09-22',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'TimerStartEvent_3',
    name: 'Yet another timer start event',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDuration': {
        _: 'P0Y0M0DT0H0M2S',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'MessageStartEvent_1',
    name: 'Wait for TestMessage',
    'bpmn:outgoing': 'SequenceFlow_0exyn8w',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }, {
    id: 'MessageStartEvent_2',
    name: 'Wait for another TestMessage',
    'bpmn:outgoing': 'SequenceFlow_0jy2lb5',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_2'
    }
  }],
};

module.exports.sampleEndEvents = {
  'bpmn:endEvent': [{
    id: 'EndEvent',
    name: 'Regular End',
    'bpmn:incoming': 'SequenceFlow_08s938g'
  }, {
    id: 'MessageEndEvent_1',
    name: 'Ends with message',
    'bpmn:incoming': 'SequenceFlow_0woaapg',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }, {
    id: 'MessageEndEvent_2',
    name: 'Ends with another message',
    'bpmn:incoming': 'SequenceFlow_0woaapg',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_2'
    }
  }, {
    id: 'MessageEndEvent_3',
    name: 'Ends with yet another message',
    'bpmn:incoming': 'SequenceFlow_0woaapg',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_3'
    }
  }, {
    id: 'SignalEndEvent',
    name: 'End with Signal',
    'bpmn:incoming': 'SequenceFlow_0pj67d9',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'TerminateEndEvent',
    name: 'End with termination',
    'bpmn:incoming': 'SequenceFlow_1b7oqkt',
    'bpmn:terminateEventDefinition': ''
  }, {
    id: 'ErrorEndEvent_1',
    name: 'End with an error',
    'bpmn:incoming': 'SequenceFlow_1b7oqkt',
    'bpmn:errorEventDefinition': ''
  }, {
    id: 'ErrorEndEvent_1',
    name: 'End with another error',
    'bpmn:incoming': 'SequenceFlow_1b7oqkt',
    'bpmn:errorEventDefinition': {
      errorRef: 'Error_2'
    }
  }]
};

module.exports.sampleEndEventsWithInputValues = {
  'bpmn:endEvent': [{
    id: 'Event_1',
    name: 'Ends with message',
    'bpmn:incoming': 'SequenceFlow_0woaapg',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    },
    'bpmn:extensionElements': {
      'camunda:properties': {
        'camunda:property': {
          name: 'inputValues',
          value: 'value',
        },
      },
    },
  }, {
    id: 'Event_2',
    name: 'End with Signal',
    'bpmn:incoming': 'SequenceFlow_0pj67d9',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    },
    'bpmn:extensionElements': {
      'camunda:properties': {
        'camunda:property': {
          name: 'inputValues',
          value: ['value1', 'value2', 'value3'],
        },
      },
    },
  }, {
    id: 'Event_3',
    name: 'End with Signal',
    'bpmn:incoming': 'SequenceFlow_0pj67d9',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    },
    'bpmn:extensionElements': {
      'camunda:properties': {
        'camunda:property': {
          name: 'inputValues',
          value: undefined,
        },
      },
    },
  }]
};

module.exports.sampleBoundaryEvents = {
  'bpmn:boundaryEvent': [{
    id: 'SignalBoundaryEvent_1',
    name: 'Wait for TestSignal',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_115y68b',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'SignalBoundaryEvent_2',
    name: 'Also wait for TestSignal',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_115y68b',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'TimerBoundaryEvent_1',
    name: 'Random timer',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDate': {
        _: '2019-12-31',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'TimerBoundaryEvent_2',
    name: 'Random timer',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDate': {
        _: '2019-09-22',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'TimerBoundaryEvent_3',
    name: 'Random timer',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDuration': {
        _: 'P0Y0M0DT0H0M2S',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'MessageBoundaryEvent_1',
    name: 'Wait for TestMessage',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_0exyn8w',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }, {
    id: 'ErrorBoundaryEvent_1',
    name: 'Wait for error',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_0exyn8w',
    'bpmn:errorEventDefinition': {
      errorRef: 'Error_1'
    }
  }],
}

module.exports.sampleIntermediateCatchEvents = {
  'bpmn:intermediateCatchEvent': [{
    id: 'TimerCatchEvent_1',
    name: 'some timer',
    'bpmn:incoming': 'SequenceFlow_0exyn8w',
    'bpmn:outgoing': 'SequenceFlow_1b7oqkt',
    'bpmn:timerEventDefinition': {
      'bpmn:timeDuration': {
        _: 'P0Y0M0DT0H0M2S',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }, {
    id: 'SignalCatchEvent_1',
    name: 'Signal Event 1',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'SignalCatchEvent_2',
    name: 'Signal Event 2',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_2'
    }
  }, {
    id: 'SignalCatchEvent_3',
    name: 'Signal Event 3',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_3'
    }
  }, {
    id: 'MessageCatchEvent_1',
    name: 'Message Event 1',
    'bpmn:incoming': 'SequenceFlow_115y68b',
    'bpmn:outgoing': 'SequenceFlow_0pj67d9',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }, {
    id: 'LinKCatchEvent_1',
    name: 'Link Event 1',
    'bpmn:incoming': 'SequenceFlow_1louer3',
    'bpmn:outgoing': 'SequenceFlow_0woaapg',
    'bpmn:linkEventDefinition': {
      name: 'Link_1'
    }
  }, {
    id: 'LinKCatchEvent_2',
    name: 'Link Event 2',
    'bpmn:incoming': 'SequenceFlow_1louer3',
    'bpmn:outgoing': 'SequenceFlow_0woaapg',
    'bpmn:linkEventDefinition': {
      name: 'Link_2'
    }
  }],
};

module.exports.sampleIntermediateThrowEvents = {
  'bpmn:intermediateThrowEvent': [{
    id: 'SignalThrowEvent_1',
    name: 'Signal Event 1',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'SignalThrowEvent2',
    name: 'Signal Event 2',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    }
  }, {
    id: 'MessageThrowEvent_1',
    name: 'Message Event 1',
    'bpmn:incoming': 'SequenceFlow_115y68b',
    'bpmn:outgoing': 'SequenceFlow_0pj67d9',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }, {
    id: 'MessageThrowEvent_2',
    name: 'Message Event 2',
    'bpmn:incoming': 'SequenceFlow_115y68b',
    'bpmn:outgoing': 'SequenceFlow_0pj67d9',
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_2'
    }
  }, {
    id: 'LinKThrowEvent_1',
    name: 'Link Event 1',
    'bpmn:incoming': 'SequenceFlow_1louer3',
    'bpmn:outgoing': 'SequenceFlow_0woaapg',
    'bpmn:linkEventDefinition': {
      name: 'Link_1'
    }
  }, {
    id: 'LinKThrowEvent_2',
    name: 'Link Event 2',
    'bpmn:incoming': 'SequenceFlow_1louer3',
    'bpmn:outgoing': 'SequenceFlow_0woaapg',
    'bpmn:linkEventDefinition': {
      name: 'Link_2'
    }
  }, {
    id: 'LinKThrowEvent_3',
    name: 'Link Event 3',
    'bpmn:incoming': 'SequenceFlow_1louer3',
    'bpmn:outgoing': 'SequenceFlow_0woaapg',
    'bpmn:linkEventDefinition': {
      name: 'Link_1'
    }
  }],
}

module.exports.misconfiguredEvents = {
  'bpmn:intermediateThrowEvent': [{
    id: 'SignalThrowEvent_1',
    name: 'Signal Event 1',
    'bpmn:incoming': 'SequenceFlow_00h99uz',
    'bpmn:outgoing': 'SequenceFlow_08s938g',
    'bpmn:signalEventDefinition': {
      signalRef: 'Signal_1'
    },
    'bpmn:messageEventDefinition': {
      messageRef: 'Message_1'
    }
  }]
};

module.exports.boundaryEventsWithCyclicTimers = {
  'bpmn:boundaryEvent': [{
    id: 'TimerBoundaryEvent_1',
    name: 'Random timer',
    attachedToRef: 'ManualTask123',
    'bpmn:outgoing': 'SequenceFlow_00h99uz',
    'bpmn:timerEventDefinition': {
      'bpmn:timeCycle': {
        _: '* * * * 1',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }]
};
