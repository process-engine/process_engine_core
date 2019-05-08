import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../../../type_factory';

export function createActivityInstance<TActivity extends Model.Activities.Activity>(data: any, type: Model.Base.IConstructor<TActivity>): TActivity {

  // eslint-disable-next-line 6river/new-cap
  let instance: TActivity = new type();
  instance = <TActivity> setCommonObjectPropertiesFromData(data, instance);

  instance.incoming = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowIncoming) || [];
  instance.outgoing = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowOutgoing) || [];

  instance.name = data.name;
  instance.defaultOutgoingSequenceFlowId = data.default;

  return instance;
}
