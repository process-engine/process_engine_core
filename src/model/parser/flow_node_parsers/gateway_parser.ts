import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../../type_factory';

export function parseGatewaysFromProcessData(processData: any): Array<Model.Gateways.Gateway> {

  const exclusiveGateways: Array<Model.Gateways.ExclusiveGateway> =
    parseGatewaysByType(processData, BpmnTags.GatewayElement.ExclusiveGateway, Model.Gateways.ExclusiveGateway);

  const parallelGateways: Array<Model.Gateways.ParallelGateway> =
    parseGatewaysByType(processData, BpmnTags.GatewayElement.ParallelGateway, Model.Gateways.ParallelGateway);

  const inclusiveGateways: Array<Model.Gateways.InclusiveGateway> =
    parseGatewaysByType(processData, BpmnTags.GatewayElement.InclusiveGateway, Model.Gateways.InclusiveGateway);

  const complexGateways: Array<Model.Gateways.ComplexGateway> =
    parseGatewaysByType(processData, BpmnTags.GatewayElement.ComplexGateway, Model.Gateways.ComplexGateway);

  return Array.prototype.concat(parallelGateways, exclusiveGateways, inclusiveGateways, complexGateways);
}

function parseGatewaysByType<TGateway extends Model.Gateways.Gateway>(
  processData: Array<any>,
  gatewayType: BpmnTags.GatewayElement,
  type: Model.Base.IConstructor<TGateway>,
): Array<TGateway> {

  const gateways: Array<TGateway> = [];

  const gatewaysRaw: Array<any> = getModelPropertyAsArray(processData, gatewayType);

  if (!gatewaysRaw || gatewaysRaw.length === 0) {
    return [];
  }

  for (const gatewayRaw of gatewaysRaw) {
    // eslint-disable-next-line 6river/new-cap
    let gateway: TGateway = new type();
    gateway = <TGateway> setCommonObjectPropertiesFromData(gatewayRaw, gateway);
    gateway.name = gatewayRaw.name;
    gateway.defaultOutgoingSequenceFlowId = gatewayRaw.default;
    gateway.incoming = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    gateway.outgoing = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);
    gateways.push(gateway);
  }

  return gateways;
}
