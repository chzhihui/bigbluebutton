import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import Meetings from '/imports/api/meetings';
import Users from '/imports/api/users';
import RedisPubSub from '/imports/startup/server/redis';
import { extractCredentials } from '/imports/api/common/server/helpers';

const TOKEN = Meteor.settings.private.app.hzhToken;

function processPreactionUrl(preaction) {
  if (preaction.indexOf('?') > 0) {
    return `${preaction}&token=${TOKEN}`;
  }
  return `${preaction}?token=${TOKEN}`;
}

export default function startLiveStream(options) {
  const REDIS_CONFIG = Meteor.settings.private.redis;
  const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
  const EVENT_NAME = 'StartLiveStreamMsg';

  const { meetingId, requesterUserId: userId } = extractCredentials(this.userId);
  const { liveStreamUrl } = options;

  try {
    check(meetingId, String);
    check(userId, String);
    check(liveStreamUrl, Object);

    const user = Users.findOne({ meetingId, userId, presenter: true }, { presenter: 1 });

    if (!user) {
      Logger.error(`Only presenters are allowed to start live-stream for a meeting. meeting=${meetingId} userId=${userId}`);
      return;
    }
    if (liveStreamUrl.preaction) {
      try {
        const result = HTTP.get(processPreactionUrl(liveStreamUrl.preaction));
        Logger.info('preaction called successfully', result);
      } catch (e) {
        Logger.error(`failed to execute preaction,${liveStreamUrl}`, e);
      }
    }

    const liveUrl = {
      id: liveStreamUrl.id,
      url: liveStreamUrl.url,
      height: liveStreamUrl.height,
      width: liveStreamUrl.width,
    };

    Meetings.update({ meetingId },
      { $set: { liveStreamUrl: liveUrl } });

    const payload = { liveStreamUrl: liveUrl };

    Logger.info(`User id=${userId} sharing an live video: ${liveStreamUrl} for meeting ${meetingId}`);

    RedisPubSub.publishUserMessage(CHANNEL, EVENT_NAME, meetingId, userId, payload);
  } catch (error) {
    Logger.error(`Error on sharing an live video: ${liveStreamUrl} ${error}`);
  }
}
