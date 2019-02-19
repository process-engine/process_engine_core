import {BpmnTags, IParsedObjectModel, Model} from '@process-engine/process_model.contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from './../type_factory';

export function parseCollaboration(parsedObjectModel: IParsedObjectModel): Model.Types.Collaboration {

  const collaborationData: any = parsedObjectModel[BpmnTags.CommonElement.Collaboration];

  const collaboration: Model.Types.Collaboration = createObjectWithCommonProperties(parsedObjectModel, Model.Types.Collaboration);

  collaboration.participants = getCollaborationParticipants(collaborationData);

  return collaboration;
}

function getCollaborationParticipants(collaborationData: any): Array<Model.Types.Participant> {

  // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
  // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
  // is what our object model expects.
  const participantData: Array<any> = getModelPropertyAsArray(collaborationData, BpmnTags.CommonElement.Participant);

  const convertedParticipants: Array<Model.Types.Participant> = [];

  for (const participantRaw of participantData) {
    const participant: Model.Types.Participant = createObjectWithCommonProperties(participantRaw, Model.Types.Participant);

    participant.name = participantRaw.name;
    participant.processReference = participantRaw.processRef;

    convertedParticipants.push(participant);
  }

  return convertedParticipants;
}
