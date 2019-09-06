module.exports.ProcessWithMixedFlowNodes = {
  id: 'process_engine_io_release',
  name: 'process_engine_io_release',
  isExecutable: 'true',
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1xzf0d3',
      name: 'Release Manager',
      'bpmn:flowNodeRef': ['release_durchfuehren',
        'ExclusiveSplitGateway_1',
        'EndEvent_0y6uwzm',
        'ParallelJoinGateway_1',
        'ParallelSplitGateway_1',
        'EndEvent_0eie6q6',
        'Task_1tfjjzx',
        'Task_0a4b1bm',
        'Task_0bbikg1',
        'ExclusiveJoinGateway_1',
        'ausserordentlicher_start',
        'jeden_donnerstag_start'
      ]
    }
  },
  'bpmn:userTask': {
    id: 'release_durchfuehren',
    name: 'Release durchführen?',
    'camunda:formKey': 'Form Key',
    'bpmn:extensionElements': {
      'camunda:formData': {
        'camunda:formField': {
          id: 'release_durchfuehren',
          label: 'Soll ein process-engine.io Release erstellt werden? ',
          type: 'boolean',
          defaultValue: ''
        }
      },
      'camunda:properties': {
        'camunda:property': {
          name: 'preferredControl',
          value: 'confirm'
        }
      }
    },
    'bpmn:incoming': 'SequenceFlow_0c373kd',
    'bpmn:outgoing': 'SequenceFlow_1oy0eez'
  },
  'bpmn:exclusiveGateway': [{
    id: 'ExclusiveSplitGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': 'SequenceFlow_1oy0eez',
    'bpmn:outgoing': ['SequenceFlow_0qg5z1e', 'SequenceFlow_1ukf8v1']
  }, {
    id: 'ExclusiveJoinGateway_1',
    name: '',
    'bpmn:incoming': ['SequenceFlow_0qg5z1e', 'SequenceFlow_0z1m3md'],
    'bpmn:outgoing': 'SequenceFlow_07juolu'
  }],
  'bpmn:endEvent': [{
    id: 'EndEvent_0y6uwzm',
    name: 'Kein Release',
    'bpmn:incoming': 'SequenceFlow_1ukf8v1'
  }, {
    id: 'EndEvent_0eie6q6',
    name: 'Release erstellt',
    'bpmn:incoming': 'SequenceFlow_0822sfy'
  }],
  'bpmn:parallelGateway': [{
    id: 'ParallelJoinGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': ['SequenceFlow_0uaexrv',
      'SequenceFlow_10xcr5a',
      'SequenceFlow_10lignn'
    ],
    'bpmn:outgoing': 'SequenceFlow_0822sfy'
  }, {
    id: 'ParallelSplitGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': 'SequenceFlow_07juolu',
    'bpmn:outgoing': ['SequenceFlow_1nt9fw9',
      'SequenceFlow_1vprubq',
      'SequenceFlow_17awqho'
    ]
  }],
  'bpmn:callActivity': [{
    id: 'Task_1tfjjzx',
    name: 'BPMN-Studio releasen',
    calledElement: 'bpmn_studio_release',
    'bpmn:incoming': 'SequenceFlow_1nt9fw9',
    'bpmn:outgoing': 'SequenceFlow_0uaexrv'
  }, {
    id: 'Task_0a4b1bm',
    name: 'ProcessEngine.ts releasen',
    calledElement: 'process_engine_ts_release',
    'bpmn:incoming': 'SequenceFlow_1vprubq',
    'bpmn:outgoing': 'SequenceFlow_10xcr5a'
  }, {
    id: 'Task_0bbikg1',
    name: 'ProcessEngine.NET releasen',
    calledElement: 'process_engine_net_release',
    'bpmn:incoming': 'SequenceFlow_17awqho',
    'bpmn:outgoing': 'SequenceFlow_10lignn'
  }],
  'bpmn:startEvent': [{
    id: 'ausserordentlicher_start',
    name: 'Außerordentliches Release',
    'bpmn:outgoing': 'SequenceFlow_0z1m3md'
  }, {
    id: 'jeden_donnerstag_start',
    name: 'Jeden Donnerstag',
    'bpmn:outgoing': 'SequenceFlow_0c373kd',
    'bpmn:timerEventDefinition': {
      'bpmn:timeCycle': {
        _: '0 9 * * 4',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }]
};


module.exports.ProcessWithMissingIds = {
  id: 'process_engine_io_release',
  name: 'process_engine_io_release',
  isExecutable: 'true',
  'bpmn:laneSet': {
    'bpmn:lane': {
      id: 'Lane_1xzf0d3',
      name: 'Release Manager',
      'bpmn:flowNodeRef': ['release_durchfuehren',
        'ExclusiveSplitGateway_1',
        'EndEvent_0y6uwzm',
        'ParallelJoinGateway_1',
        'ParallelSplitGateway_1',
        'EndEvent_0eie6q6',
        'Task_1tfjjzx',
        'Task_0a4b1bm',
        'Task_0bbikg1',
        'ExclusiveJoinGateway_1',
        'ausserordentlicher_start',
        'jeden_donnerstag_start'
      ]
    }
  },
  'bpmn:userTask': {
    name: 'Release durchführen?',
    'camunda:formKey': 'Form Key',
    'bpmn:extensionElements': {
      'camunda:formData': {
        'camunda:formField': {
          id: 'release_durchfuehren',
          label: 'Soll ein process-engine.io Release erstellt werden? ',
          type: 'boolean',
          defaultValue: ''
        }
      },
      'camunda:properties': {
        'camunda:property': {
          name: 'preferredControl',
          value: 'confirm'
        }
      }
    },
    'bpmn:incoming': 'SequenceFlow_0c373kd',
    'bpmn:outgoing': 'SequenceFlow_1oy0eez'
  },
  'bpmn:exclusiveGateway': [{
    id: 'ExclusiveSplitGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': 'SequenceFlow_1oy0eez',
    'bpmn:outgoing': ['SequenceFlow_0qg5z1e', 'SequenceFlow_1ukf8v1']
  }, {
    id: 'ExclusiveJoinGateway_1',
    name: '',
    'bpmn:incoming': ['SequenceFlow_0qg5z1e', 'SequenceFlow_0z1m3md'],
    'bpmn:outgoing': 'SequenceFlow_07juolu'
  }],
  'bpmn:endEvent': [{
    id: 'EndEvent_0y6uwzm',
    name: 'Kein Release',
    'bpmn:incoming': 'SequenceFlow_1ukf8v1'
  }, {
    id: 'EndEvent_0eie6q6',
    name: 'Release erstellt',
    'bpmn:incoming': 'SequenceFlow_0822sfy'
  }],
  'bpmn:parallelGateway': [{
    id: 'ParallelJoinGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': ['SequenceFlow_0uaexrv',
      'SequenceFlow_10xcr5a',
      'SequenceFlow_10lignn'
    ],
    'bpmn:outgoing': 'SequenceFlow_0822sfy'
  }, {
    id: 'ParallelSplitGateway_1',
    name: '',
    'bpmn:extensionElements': {
      'camunda:formData': ''
    },
    'bpmn:incoming': 'SequenceFlow_07juolu',
    'bpmn:outgoing': ['SequenceFlow_1nt9fw9',
      'SequenceFlow_1vprubq',
      'SequenceFlow_17awqho'
    ]
  }],
  'bpmn:callActivity': [{
    id: 'Task_1tfjjzx',
    name: 'BPMN-Studio releasen',
    calledElement: 'bpmn_studio_release',
    'bpmn:incoming': 'SequenceFlow_1nt9fw9',
    'bpmn:outgoing': 'SequenceFlow_0uaexrv'
  }, {
    id: 'Task_0a4b1bm',
    name: 'ProcessEngine.ts releasen',
    calledElement: 'process_engine_ts_release',
    'bpmn:incoming': 'SequenceFlow_1vprubq',
    'bpmn:outgoing': 'SequenceFlow_10xcr5a'
  }, {
    id: 'Task_0bbikg1',
    name: 'ProcessEngine.NET releasen',
    calledElement: 'process_engine_net_release',
    'bpmn:incoming': 'SequenceFlow_17awqho',
    'bpmn:outgoing': 'SequenceFlow_10lignn'
  }],
  'bpmn:startEvent': [{
    id: 'ausserordentlicher_start',
    name: 'Außerordentliches Release',
    'bpmn:outgoing': 'SequenceFlow_0z1m3md'
  }, {
    id: 'jeden_donnerstag_start',
    name: 'Jeden Donnerstag',
    'bpmn:outgoing': 'SequenceFlow_0c373kd',
    'bpmn:timerEventDefinition': {
      'bpmn:timeCycle': {
        _: '0 9 * * 4',
        'xsi:type': 'bpmn:tFormalExpression'
      }
    }
  }]
};
