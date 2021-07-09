import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import WhiteboardOverlayContainer from '/imports/ui/components/whiteboard/whiteboard-overlay/container';
import WhiteboardToolbarContainer from '/imports/ui/components/whiteboard/whiteboard-toolbar/container';
import { HUNDRED_PERCENT, MAX_PERCENT } from '/imports/utils/slideCalcUtils';
import { defineMessages, injectIntl, intlShape } from 'react-intl';
import CursorWrapperContainer from '../presentation/cursor/cursor-wrapper-container/container';
import AnnotationGroupContainer from '../whiteboard/annotation-group/container';
import PresentationOverlayContainer from '../presentation/presentation-overlay/container';
import { styles } from './styles.scss';
import MediaService, { shouldEnableSwapLayout } from '../media/service';
import FullscreenService from '../fullscreen-button/service';
import FullscreenButtonContainer from '../fullscreen-button/container';
import RtcPlayer from './js/srswebrtcplayer';
import { getLiveUrl } from './service';

const intlMessages = defineMessages({
  presentationLabel: {
    id: 'app.presentationUploder.title',
    description: 'presentation area element label',
  },
  changeNotification: {
    id: 'app.presentation.notificationLabel',
    description: 'label displayed in toast when presentation switches',
  },
  slideContentStart: {
    id: 'app.presentation.startSlideContent',
    description: 'Indicate the slide content start',
  },
  slideContentEnd: {
    id: 'app.presentation.endSlideContent',
    description: 'Indicate the slide content end',
  },
  noSlideContent: {
    id: 'app.presentation.emptySlideContent',
    description: 'No content available for slide',
  },
});

const ALLOW_FULLSCREEN = Meteor.settings.public.app.allowFullscreen;


function processPlayUrl(url, cb) {
  getLiveUrl(url).then(ret => cb(ret));
};


class PresentationArea extends PureComponent {
  constructor() {
    super();

    this.state = {
      presentationAreaWidth: 0,
      presentationAreaHeight: 0,
      showSlide: false,
      zoom: 100,
      fitToWidth: false,
      isFullscreen: false,
    };

    this.getSvgRef = this.getSvgRef.bind(this);
    this.setFitToWidth = this.setFitToWidth.bind(this);
    this.zoomChanger = this.zoomChanger.bind(this);
    this.updateLocalPosition = this.updateLocalPosition.bind(this);
    this.panAndZoomChanger = this.panAndZoomChanger.bind(this);
    this.fitToWidthHandler = this.fitToWidthHandler.bind(this);
    this.onFullscreenChange = this.onFullscreenChange.bind(this);
    this.onResize = () => setTimeout(this.handleResize.bind(this), 0);
    this.videoElementReady = this.videoElementReady.bind(this);
    // console.log('live stream constructor');
  }

  componentDidMount() {
    // adding an event listener to scale the whiteboard on 'resize' events sent by chat/userlist etc
    window.addEventListener('resize', this.onResize);

    this.getInitialPresentationSizes();
    this.refPresentationContainer.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.refPresentationContainer.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  onFullscreenChange() {
    const { isFullscreen } = this.state;
    const newIsFullscreen = FullscreenService.isFullScreen(this.refPresentationContainer);
    if (isFullscreen !== newIsFullscreen) {
      this.setState({ isFullscreen: newIsFullscreen });
      window.dispatchEvent(new Event('resize'));
    }
  }

  videoElementReady(element) {
    if (!element) return;
    console.log('video element ready,', element, this.webRtcServer);
    this.videoElement = element;
    const { currentVideo } = this.props;
    this.webRtcServer = new RtcPlayer(this.videoElement,processPlayUrl);
    this.webRtcServer.play(currentVideo);
  }

  // returns a ref to the svg element, which is required by a WhiteboardOverlay
  // to transform screen coordinates to svg coordinate system
  getSvgRef() {
    return this.svggroup;
  }

  getToolbarHeight() {
    const { refPresentationToolbar } = this;
    let height = 0;
    if (refPresentationToolbar) {
      const { clientHeight } = refPresentationToolbar;
      height = clientHeight;
    }
    return height;
  }

  getPresentationSizesAvailable() {
    const { userIsPresenter, multiUser } = this.props;
    const { refPresentationArea, refWhiteboardArea } = this;
    const presentationSizes = {};

    if (refPresentationArea && refWhiteboardArea) {
      // By default presentation sizes are equal to the sizes of the refPresentationArea
      // direct parent of the svg wrapper
      let { clientWidth, clientHeight } = refPresentationArea;

      // if a user is a presenter - this means there is a whiteboard toolbar on the right
      // and we have to get the width/height of the refWhiteboardArea
      // (inner hidden div with absolute position)
      if (userIsPresenter || multiUser) {
        ({ clientWidth, clientHeight } = refWhiteboardArea);
      }

      presentationSizes.presentationAreaHeight = clientHeight - this.getToolbarHeight();
      presentationSizes.presentationAreaWidth = clientWidth;
    }
    return presentationSizes;
  }

  getInitialPresentationSizes() {
    // determining the presentationAreaWidth and presentationAreaHeight (available
    // space for the svg) on the initial load

    const presentationSizes = this.getPresentationSizesAvailable();
    if (Object.keys(presentationSizes).length > 0) {
      // setting the state of the available space for the svg
      // and set the showSlide to true to start rendering the slide
      this.setState({
        presentationAreaHeight: presentationSizes.presentationAreaHeight,
        presentationAreaWidth: presentationSizes.presentationAreaWidth,
        showSlide: true,
      });
    }
  }

  setFitToWidth(fitToWidth) {
    this.setState({ fitToWidth });
  }

  handleResize() {
    const presentationSizes = this.getPresentationSizesAvailable();
    if (Object.keys(presentationSizes).length > 0) {
      // updating the size of the space available for the slide
      this.setState({
        presentationAreaHeight: presentationSizes.presentationAreaHeight,
        presentationAreaWidth: presentationSizes.presentationAreaWidth,
      });
    }
  }

  calculateSize(viewBoxDimensions) {
    const {
      presentationAreaHeight,
      presentationAreaWidth,
      fitToWidth,
    } = this.state;

    const {
      userIsPresenter,
      currentVideo,
      slidePosition,
    } = this.props;

    if (!currentVideo || !slidePosition) {
      return { width: 0, height: 0 };
    }

    const originalWidth = slidePosition.width;
    const originalHeight = slidePosition.height;
    const viewBoxWidth = viewBoxDimensions.width;
    const viewBoxHeight = viewBoxDimensions.height;

    let svgWidth;
    let svgHeight;

    if (!userIsPresenter) {
      svgWidth = (presentationAreaHeight * viewBoxWidth) / viewBoxHeight;
      if (presentationAreaWidth < svgWidth) {
        svgHeight = (presentationAreaHeight * presentationAreaWidth) / svgWidth;
        svgWidth = presentationAreaWidth;
      } else {
        svgHeight = presentationAreaHeight;
      }
    } else if (!fitToWidth) {
      svgWidth = (presentationAreaHeight * originalWidth) / originalHeight;
      if (presentationAreaWidth < svgWidth) {
        svgHeight = (presentationAreaHeight * presentationAreaWidth) / svgWidth;
        svgWidth = presentationAreaWidth;
      } else {
        svgHeight = presentationAreaHeight;
      }
    } else {
      svgWidth = presentationAreaWidth;
      svgHeight = (svgWidth * originalHeight) / originalWidth;
      if (svgHeight > presentationAreaHeight) svgHeight = presentationAreaHeight;
    }

    return {
      width: svgWidth,
      height: svgHeight,
    };
  }

  zoomChanger(incomingZoom) {
    const {
      zoom,
    } = this.state;

    let newZoom = incomingZoom;

    if (newZoom <= HUNDRED_PERCENT) {
      newZoom = HUNDRED_PERCENT;
    } else if (incomingZoom >= MAX_PERCENT) {
      newZoom = MAX_PERCENT;
    }

    if (newZoom !== zoom) this.setState({ zoom: newZoom });
  }

  fitToWidthHandler() {
    const {
      fitToWidth,
    } = this.state;

    this.setState({
      fitToWidth: !fitToWidth,
      zoom: HUNDRED_PERCENT,
    });
  }

  isPresentationAccessible() {
    const {
      currentVideo,
      slidePosition,
    } = this.props;
    // sometimes tomcat publishes the slide url, but the actual file is not accessible
    return currentVideo && slidePosition;
  }

  updateLocalPosition(x, y, width, height, zoom) {
    this.setState({
      localPosition: {
        x, y, width, height,
      },
      zoom,
    });
  }

  panAndZoomChanger(w, h, x, y) {
    const {
      currentVideo,
      podId,
      zoomSlide,
    } = this.props;

  //  zoomSlide(currentSlide.num, podId, w, h, x, y);
  }

  renderOverlays(slideObj, svgDimensions, viewBoxPosition, viewBoxDimensions, physicalDimensions) {
    const {
      userIsPresenter,
      multiUser,
      podId,
      currentVideo,
      slidePosition,
    } = this.props;

    const {
      zoom,
      fitToWidth,
    } = this.state;
    // eslint-disable-next-line no-undef
    // console.log(`presenter:${userIsPresenter},multi user:${multiUser}`);
    if (!userIsPresenter && !multiUser) {
      return null;
    }

    // retrieving the pre-calculated data from the slide object
    const {
      width,
      height,
    } = slidePosition;

    return (
      <PresentationOverlayContainer
        podId={podId}
        userIsPresenter={userIsPresenter}
        currentSlideNum={1}
        slide={slideObj}
        slideWidth={width}
        slideHeight={height}
        viewBoxX={viewBoxPosition.x}
        viewBoxY={viewBoxPosition.y}
        viewBoxWidth={viewBoxDimensions.width}
        viewBoxHeight={viewBoxDimensions.height}
        physicalSlideWidth={physicalDimensions.width}
        physicalSlideHeight={physicalDimensions.height}
        svgWidth={svgDimensions.width}
        svgHeight={svgDimensions.height}
        zoom={zoom}
        zoomChanger={this.zoomChanger}
        updateLocalPosition={this.updateLocalPosition}
        panAndZoomChanger={this.panAndZoomChanger}
        getSvgRef={this.getSvgRef}
        fitToWidth={fitToWidth}
      >
        <WhiteboardOverlayContainer
          getSvgRef={this.getSvgRef}
          userIsPresenter={userIsPresenter}
          whiteboardId={slideObj.id}
          slide={slideObj}
          slideWidth={width}
          slideHeight={height}
          viewBoxX={viewBoxPosition.x}
          viewBoxY={viewBoxPosition.y}
          viewBoxWidth={viewBoxDimensions.width}
          viewBoxHeight={viewBoxDimensions.height}
          physicalSlideWidth={physicalDimensions.width}
          physicalSlideHeight={physicalDimensions.height}
          zoom={zoom}
          zoomChanger={this.zoomChanger}
        />
      </PresentationOverlayContainer>
    );
  }

  // renders the whole presentation area
  renderPresentationArea(svgDimensions, viewBoxDimensions) {
    const {
      intl,
      podId,
      currentVideo,
      slidePosition,
      userIsPresenter,
    } = this.props;

    const {
      localPosition,
    } = this.state;

    if (!this.isPresentationAccessible()) {
      return null;
    }

    // retrieving the pre-calculated data from the slide object
    const {
      width,
      height,
    } = slidePosition;


    let viewBoxPosition;

    if (userIsPresenter && localPosition) {
      viewBoxPosition = {
        x: localPosition.x,
        y: localPosition.y,
      };
    } else {
      viewBoxPosition = {
        x: slidePosition.x,
        y: slidePosition.y,
      };
    }

    const widthRatio = viewBoxDimensions.width / width;
    const heightRatio = viewBoxDimensions.height / height;

    const physicalDimensions = {
      width: (svgDimensions.width / widthRatio),
      height: (svgDimensions.height / heightRatio),
    };

    const svgViewBox = `${viewBoxPosition.x} ${viewBoxPosition.y} `
      + `${viewBoxDimensions.width} ${Number.isNaN(viewBoxDimensions.height) ? 0 : viewBoxDimensions.height}`;


    return (
      <div
        style={{
          position: 'absolute',
          width: svgDimensions.width < 0 ? 0 : svgDimensions.width,
          height: svgDimensions.height < 0 ? 0 : svgDimensions.height,
        }}
      >
        <video
          nocontrols="true"
          muted
          className={styles.videoPlayer}
          ref={this.videoElementReady}
          style={{
            position: 'absolute',
            width: svgDimensions.width < 0 ? 0 : svgDimensions.width,
            height: svgDimensions.height < 0 ? 0 : svgDimensions.height,
            textAlign: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: svgDimensions.width < 0 ? 0 : svgDimensions.width,
            height: svgDimensions.height < 0 ? 0 : svgDimensions.height,
            textAlign: 'center',
          }}
        >

          <span id="currentSlideText" className={styles.visuallyHidden} />
          {this.renderPresentationFullscreen()}
          <svg
            key={currentVideo.id}
            data-test="whiteboard"
            width={svgDimensions.width < 0 ? 0 : svgDimensions.width}
            height={svgDimensions.height < 0 ? 0 : svgDimensions.height}
            ref={(ref) => { if (ref != null) { this.svggroup = ref; } }}
            viewBox={svgViewBox}
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.svgStyles}
          >

            <defs>
              <clipPath id="viewBox">
                <rect x={viewBoxPosition.x} y={viewBoxPosition.y} width="100%" height="100%" fill="none" />
              </clipPath>
            </defs>
            <g clipPath="url(#viewBox)">

              <AnnotationGroupContainer
                {...{
                  width,
                  height,
                }}
                published
                whiteboardId={currentVideo.id}
              />
              <AnnotationGroupContainer
                  {...{
                    width,
                    height,
                  }}
                  published={false}
                  whiteboardId={currentVideo.id}
              />
              <CursorWrapperContainer
                podId={podId}
                whiteboardId={currentVideo.id}
                widthRatio={widthRatio}
                physicalWidthRatio={svgDimensions.width / width}
                slideWidth={width}
                slideHeight={height}
              />
            </g>
            {this.renderOverlays(
              currentVideo,
              svgDimensions,
              viewBoxPosition,
              viewBoxDimensions,
              physicalDimensions,
            )}
          </svg>
        </div>
      </div>
    );
  }

  renderWhiteboardToolbar(svgDimensions) {
    const { currentVideo } = this.props;
    if (!this.isPresentationAccessible()) return null;

    return (
      <WhiteboardToolbarContainer
        whiteboardId={currentVideo.id}
        height={svgDimensions.height}
      />
    );
  }

  renderPresentationFullscreen() {
    const {
      intl,
      userIsPresenter,
    } = this.props;
    const { isFullscreen } = this.state;

    if (!ALLOW_FULLSCREEN) return null;

    return (
      <FullscreenButtonContainer
        fullscreenRef={this.refPresentationContainer}
        elementName={intl.formatMessage(intlMessages.presentationLabel)}
        isFullscreen={isFullscreen}
        dark
        bottom
      />
    );
  }

  render() {
    // console.log('live stream do render');
    const {
      userIsPresenter,
      multiUser,
      slidePosition,
      currentVideo,
    } = this.props;

    const {
      showSlide,
      fitToWidth,
      presentationAreaWidth,
      localPosition,
    } = this.state;

    let viewBoxDimensions;

    if (userIsPresenter && localPosition) {
      viewBoxDimensions = {
        width: localPosition.width,
        height: localPosition.height,
      };
    } else if (slidePosition) {
      viewBoxDimensions = {
        width: slidePosition.viewBoxWidth,
        height: slidePosition.viewBoxHeight,
      };
    } else {
      viewBoxDimensions = {
        width: 0,
        height: 0,
      };
    }

    const svgDimensions = this.calculateSize(viewBoxDimensions);
    const svgHeight = svgDimensions.height;
    const svgWidth = svgDimensions.width;

    const toolbarHeight = this.getToolbarHeight();

    let toolbarWidth = 0;
    if (this.refWhiteboardArea) {
      if (svgWidth === presentationAreaWidth
        || presentationAreaWidth <= 400
        || fitToWidth === true) {
        toolbarWidth = '100%';
      } else if (svgWidth <= 400
        && presentationAreaWidth > 400) {
        toolbarWidth = '400px';
      } else {
        toolbarWidth = svgWidth;
      }
    }
    if (this.webRtcServer) {
      this.webRtcServer.play(currentVideo);
    }
    return (
      <div
        ref={(ref) => { this.refPresentationContainer = ref; }}
        className={styles.presentationContainer}
      >
        <div
          ref={(ref) => { this.refPresentationArea = ref; }}
          className={styles.presentationArea}
        >
          <div
            ref={(ref) => { this.refWhiteboardArea = ref; }}
            className={styles.whiteboardSizeAvailable}
          />
          <div
            className={styles.svgContainer}
            style={{
              height: svgHeight + toolbarHeight,
            }}
          >
            {showSlide
              ? this.renderPresentationArea(svgDimensions, viewBoxDimensions)
              : null}
            {showSlide && (userIsPresenter || multiUser)
              ? this.renderWhiteboardToolbar(svgDimensions)
              : null}
            {showSlide && userIsPresenter
              ? (
                <div
                  className={styles.presentationToolbar}
                  ref={(ref) => { this.refPresentationToolbar = ref; }}
                  style={
                    {
                      width: toolbarWidth,
                    }
                  }
                />
              )
              : null}
          </div>
        </div>
      </div>
    );
  }
}

export default injectIntl(PresentationArea);

PresentationArea.propTypes = {
  intl: PropTypes.object.isRequired,
  podId: PropTypes.string.isRequired,
  // Defines a boolean value to detect whether a current user is a presenter
  userIsPresenter: PropTypes.bool.isRequired,
  currentVideo: PropTypes.shape({
    url: PropTypes.string.isRequired,
    //server: PropTypes.string.isRequired,
  }),
  slidePosition: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    viewBoxWidth: PropTypes.number.isRequired,
    viewBoxHeight: PropTypes.number.isRequired,
  }),
  // current multi-user status
  multiUser: PropTypes.bool.isRequired,
};

PresentationArea.defaultProps = {
  currentVideo: undefined,
  slidePosition: undefined,
  podId: '1',
};
