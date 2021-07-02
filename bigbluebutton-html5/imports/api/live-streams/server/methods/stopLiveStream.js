import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';
import Meetings from '/imports/api/meetings';
import Users from '/imports/api/users';
import RedisPubSub from '/imports/startup/server/redis';
import { extractCredentials } from '/imports/api/common/server/helpers';

export default function stopLiveStream(options) {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'StopLiveStreamMsg';

  const { meetingId, requesterUserId } = this.userId ? extractCredentials(this.userId) : options;

  try {
    check(meetingId, String);
    check(requesterUserId, String);

    const user = Users.findOne({
      meetingId,
      userId: requesterUserId,
      presenter: true,
    }, { presenter: 1 });

    if (this.userId && !user) {
      Logger.error(`Only presenters are allowed to stop live stream for a meeting. meeting=${meetingId} userId=${requesterUserId}`);
      return;
    }

    const meeting = Meetings.findOne({ meetingId });
    if (!meeting || meeting.liveStreamUrl === null) return;

    Meetings.update({ meetingId }, { $set: { liveStreamUrl: null } });
    const payload = {};

    Logger.info(`User id=${requesterUserId} stopped sharing an live stream for meeting=${meetingId}`);

    RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, requesterUserId, payload);
  } catch (error) {
    Logger.error(`Error on stop sharing an live stream for meeting=${meetingId} ${error}`);
  }
}
