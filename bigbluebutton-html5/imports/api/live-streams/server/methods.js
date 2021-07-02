import { Meteor } from 'meteor/meteor';
import startLiveStream from './methods/startLiveStream';
import stopLiveStream from './methods/stopLiveStream';
import getLiveUrl from './methods/getLiveUrl';

Meteor.methods({
  startLiveStream,
  stopLiveStream,
  getLiveUrl,
});
