/* eslint-disable @typescript-eslint/no-unused-vars */
import {FlowNodeParsers as flowNodeParsers} from './flow_node_parsers/index';

import * as collaborationParser from './collaboration_parser';
import * as definitionParser from './definitions_parser';
import * as flowNodeParser from './flow_node_parser';
import * as processLaneSetParser from './process_lane_set_parser';
import * as processParser from './process_parser';
import * as sequenceFlowParser from './sequence_flow_parser';

export namespace Parsers {
  export import CollaborationParser = collaborationParser;
  export import DefinitionParser = definitionParser;
  export import FlowNodeParser = flowNodeParser;
  export import FlowNodeParsers = flowNodeParsers;
  export import ProcessLaneSetParser = processLaneSetParser;
  export import ProcessParser = processParser;
  export import SequenceFlowParser = sequenceFlowParser;
}
