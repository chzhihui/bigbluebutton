import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { withModalMounter } from '/imports/ui/components/modal/service';
import LiveStreamModal from './component';
import { startLiveStream, stopLiveStream, getLiveStreamUrl } from '../service';

const LiveStreamModalContainer = props => <LiveStreamModal {...props} />;

export default withModalMounter(withTracker(({
  mountModal, streams,
}) => ({
  closeModal: () => {
    mountModal(null);
  },
  current: getLiveStreamUrl(),
  streams,
  startLiveStream,
  stopLiveStream,
}))(LiveStreamModalContainer));
