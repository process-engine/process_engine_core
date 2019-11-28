import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../../type_factory';

export function parseGatewaysFromProcessData(processData: any): Array<Model.Gateways.Gateway> {

  const exclusiveGateways = parseGatewaysByType(processData, BpmnTags.GatewayElement.ExclusiveGateway, Model.Gateways.ExclusiveGateway);
  const parallelGateways = parseGatewaysByType(processData, BpmnTags.GatewayElement.ParallelGateway, Model.Gateways.ParallelGateway);
  const inclusiveGateways = parseGatewaysByType(processData, BpmnTags.GatewayElement.InclusiveGateway, Model.Gateways.InclusiveGateway);
  const complexGateways = parseGatewaysByType(processData, BpmnTags.GatewayElement.ComplexGateway, Model.Gateways.ComplexGateway);

  return Array.prototype.concat(parallelGateways, exclusiveGateways, inclusiveGateways, complexGateways);
}

function parseGatewaysByType<TGateway extends Model.Gateways.Gateway>(
  processData: Array<any>,
  gatewayType: BpmnTags.GatewayElement,
  type: Model.Base.IConstructor<TGateway>,
): Array<TGateway> {

  const gateways: Array<TGateway> = [];

  const gatewaysRaw = getModelPropertyAsArray(processData, gatewayType);

  const noGatewaysFound = !(gatewaysRaw?.length > 0);
  if (noGatewaysFound) {
    return [];
  }

  for (const gatewayRaw of gatewaysRaw) {
    // eslint-disable-next-line 6river/new-cap
    let gateway = new type();
    gateway = <TGateway> setCommonObjectPropertiesFromData(gatewayRaw, gateway);
    gateway.name = gatewayRaw.name;
    gateway.defaultOutgoingSequenceFlowId = gatewayRaw.default;
    gateway.incoming = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    gateway.outgoing = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);
    gateways.push(gateway);
  }

  return gateways;
}
