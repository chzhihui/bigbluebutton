import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import MediaService, { getSwapLayout, shouldEnableSwapLayout } from '/imports/ui/components/media/service';
import { notify } from '/imports/ui/services/notification';
import { getLiveStreamUrl, isPresenter, getMultiUserStatus } from './service';
import PresentationArea from './component';
import PresentationToolbarService from '../presentation/presentation-toolbar/service';
import Auth from '/imports/ui/services/auth';
import Meetings from '/imports/api/meetings';
import Users from '/imports/api/users';
import getFromUserSettings from '/imports/ui/services/users-settings';

const ROLE_VIEWER = Meteor.settings.public.user.role_viewer;

const PresentationAreaContainer = ({ presentationPodIds, mountPresentationArea, ...props }) => (
  mountPresentationArea && <PresentationArea {...props} />
);

export default withTracker(({ podId }) => {
  // const currentSlide = PresentationAreaService.getCurrentSlide(podId);
  // console.log('entering live stream container');
  const presentationIsDownloadable = false;
  const layoutSwapped = getSwapLayout() && shouldEnableSwapLayout();
  const isViewer = Users.findOne({ meetingId: Auth.meetingID, userId: Auth.userID }, {
    fields: {
      role: 1,
    },
  }).role === ROLE_VIEWER;

  const currentVideo = getLiveStreamUrl() || {};
  const slidePosition = {
    x: 0,
    y: 0,
    width: currentVideo.width || 1920,
    height: currentVideo.height || 1080,
    viewBoxHeight: currentVideo.height || 1080,
    viewBoxWidth: currentVideo.width || 1920,
  };

  return {
    currentVideo,
    slidePosition,
    downloadPresentationUri: '',
    userIsPresenter: isPresenter() && !layoutSwapped,
    multiUser: getMultiUserStatus(currentVideo.id)
      && !layoutSwapped,
    presentationIsDownloadable,
    mountPresentationArea: true,
    currentPresentation: null, // PresentationAreaService.getCurrentPresentation(podId),
    notify,
    zoomSlide: PresentationToolbarService.zoomSlide,
    layoutSwapped,
    toggleSwapLayout: MediaService.toggleSwapLayout,
    publishedPoll: Meetings.findOne({ meetingId: Auth.meetingID }, {
      fields: {
        publishedPoll: 1,
      },
    }).publishedPoll,
    isViewer,
    currentPresentationId: Session.get('currentPresentationId') || null,
    restoreOnUpdate: getFromUserSettings(
      'bbb_force_restore_presentation_on_new_events',
      Meteor.settings.public.presentation.restoreOnUpdate,
    ),
  };
})(PresentationAreaContainer);
