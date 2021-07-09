
import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';

import Users from '/imports/api/users';

import { extractCredentials } from '/imports/api/common/server/helpers';
import SHA256 from '../utils/sha256';

const SALT = Meteor.settings.private.app.hzhLiveSalt;

export default function getLiveUrl(options) {
  const { meetingId, requesterUserId: userId } = extractCredentials(this.userId);
  const { liveStreamUrl } = options;

  try {
    check(meetingId, String);
    check(userId, String);
    check(liveStreamUrl, Object);
    if(!liveStreamUrl.url){
      return null;
    }
    const user = Users.findOne({ meetingId, userId }, { presenter: 1 });

    if (!user) {
      Logger.error(`Only User are allowed to play live video in the meeting. meeting=${meetingId} userId=${userId}`);
      return null;
    }
    const split = liveStreamUrl.url.indexOf('?') >= 0 ? '&' : '?';
    const ret = `${liveStreamUrl.url}${split}t=${new Date().getTime()}`;
    const hash = SHA256(ret + SALT);
    return `${ret}&h=${hash}`;
  } catch (error) {
    Logger.error(`Error on process live url: ${liveStreamUrl} ${error}`);
    return null;
  }
}
