import {BpmnTags, IParsedObjectModel, Model} from '@process-engine/persistence_api.contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../type_factory';

export function parseCollaboration(parsedObjectModel: IParsedObjectModel): Model.Collaboration {

  const collaborationData = parsedObjectModel[BpmnTags.CommonElement.Collaboration];

  const collaboration = createObjectWithCommonProperties(collaborationData, Model.Collaboration);

  collaboration.name = collaborationData.name;

  collaboration.participants = getCollaborationParticipants(collaborationData);

  return collaboration;
}

function getCollaborationParticipants(collaborationData: any): Array<Model.Participant> {

  // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
  // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
  // is what our object model expects.
  const participantData = getModelPropertyAsArray(collaborationData, BpmnTags.CommonElement.Participant);

  const convertedParticipants: Array<Model.Participant> = [];

  for (const participantRaw of participantData) {
    const participant = createObjectWithCommonProperties(participantRaw, Model.Participant);

    participant.name = participantRaw.name;
    participant.processReference = participantRaw.processRef;

    convertedParticipants.push(participant);
  }

  return convertedParticipants;
}
