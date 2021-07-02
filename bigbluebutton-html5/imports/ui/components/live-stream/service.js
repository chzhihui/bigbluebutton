import Meetings from '/imports/api/meetings';
import Users from '/imports/api/users';
import Auth from '/imports/ui/services/auth';
import Logger from '/imports/startup/client/logger';

import { getStreamer } from '/imports/api/live-streams';
import { makeCall } from '/imports/ui/services/api';
import WhiteboardMultiUser from '/imports/api/whiteboard-multi-user/';
import PresentationPods from '../../../api/presentation-pods';

const isUrlValid = url => url != null;

const startLiveStream = (url) => {
  const liveStreamUrl = url;
  // console.log('start live streaming', url);
  makeCall('clearWhiteboard', liveStreamUrl.id);
  // makeCall('stopLiveStream');
  makeCall('startLiveStream', { liveStreamUrl });
};

const stopLiveStream = () => {
  // console.log('stop live stream');
  makeCall('stopLiveStream');
};
const getLiveUrl = url => makeCall('getLiveUrl', { liveStreamUrl: url });

const sendMessage = (event, data) => {
  const meetingId = Auth.meetingID;
  const userId = Auth.userID;

  makeCall('emitLiveStreamEvent', event, { ...data, meetingId, userId });
};

const onMessage = (message, func) => {
  const streamer = getStreamer(Auth.meetingID);
  streamer.on(message, func);
};

const removeAllListeners = (eventType) => {
  const streamer = getStreamer(Auth.meetingID);
  streamer.removeAllListeners(eventType);
};

const getLiveStreamUrl = () => {
  const meetingId = Auth.meetingID;
  const meeting = Meetings.findOne({ meetingId },
    { fields: { liveStreamUrl: 1 } });
  // console.log('live stream url ', meeting);
  return meeting && meeting.liveStreamUrl;
};

const getLiveStreams = () => {
  const meetingId = Auth.meetingID;
  const meeting = Meetings.findOne({ meetingId },
    { fields: { liveStreams: 1 } });
  // console.log('live streams ', meeting);
  return meeting && meeting.liveStreams;
};
const getMultiUserStatus = (whiteboardId) => {
  const data = WhiteboardMultiUser.findOne({
    meetingId: Auth.meetingID,
    whiteboardId,
  });
  return data ? data.multiUser : false;
};
const isPresenter = (podId) => {
  // eslint-disable-next-line no-param-reassign
  podId = podId || 'DEFAULT_PRESENTATION_POD';
  // a main presenter in the meeting always owns a default pod
  if (podId === 'DEFAULT_PRESENTATION_POD') {
    const options = {
      filter: {
        presenter: 1,
      },
    };
    const currentUser = Users.findOne({
      userId: Auth.userID,
    }, options);
    return currentUser ? currentUser.presenter : false;
  }

  // if a pod is not default, then we check whether this user owns a current pod
  const selector = {
    meetingId: Auth.meetingID,
    podId,
  };
  const pod = PresentationPods.findOne(selector);
  return pod.currentPresenterId === Auth.userID;
};
export {
  sendMessage,
  onMessage,
  removeAllListeners,
  getLiveStreamUrl,
  isUrlValid,
  startLiveStream,
  stopLiveStream,
  getMultiUserStatus,
  isPresenter,
  getLiveStreams,
  getLiveUrl,
};
