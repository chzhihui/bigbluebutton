import React, { Component } from 'react';
import { withModalMounter } from '/imports/ui/components/modal/service';
import Modal from '/imports/ui/components/modal/simple/component';
import Button from '/imports/ui/components/button/component';
import { defineMessages, injectIntl } from 'react-intl';

import { styles } from './styles';

const intlMessages = defineMessages({
  start: {
    id: 'app.LiveStream.start',
    description: 'Share external video',
  },
  stop: {
    id: 'app.LiveStream.stop',
    description: 'Stop live stream menu button label',
  },
  urlError: {
    id: 'app.LiveStream.urlError',
    description: 'Not a video URL error',
  },
  input: {
    id: 'app.LiveStream.input',
    description: 'Video URL',
  },
  urlInput: {
    id: 'app.LiveStream.urlInput',
    description: 'URL input field placeholder',
  },
  title: {
    id: 'app.LiveStream.title',
    description: 'Modal title',
  },
  close: {
    id: 'app.LiveStream.close',
    description: 'Close',
  },
  note: {
    id: 'app.LiveStream.noteLabel',
    description: 'provides hint about Shared External videos',
  },
  switchError: {
    id: 'app.LiveStream.switchError',
    description: 'Failed to switch stream',
  },
});

class LiveStreamModal extends Component {
  constructor(props) {
    super(props);

    const { current } = props;

    this.state = {
      cid: current ? current.id : '',
    };

    this.startWatchingHandler = this.startWatchingHandler.bind(this);
    this.stopHandler = this.stopHandler.bind(this);
    this.handleClickEvent = this.handleClickEvent.bind(this);
  }

  startWatchingHandler() {
    const {
      startLiveStream,
      closeModal,
      streams, intl,
    } = this.props;
    function start(stream) {
      startLiveStream(stream);
      closeModal();
    }
    // console.log('streams', streams);
    const { cid } = this.state;
    let stream = null;
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      if (s.id === cid) {
        stream = s;
        break;
      }
    }
    if (stream) {
      start(stream);
      /* if (stream.preaction) {
        HTTP.get(stream.preaction, {}, (error, result) => {
          console.log('preaction finished,', error, result);
          if (!error) {
            start(stream);
          } else {
            alert(intl.formatMessage(intlMessages.switchError));
          }
        });
      } else {
        start(stream);
      } */
    } else {
      console.error('no stream select');
    }
  }

  stopHandler() {
    const {
      stopLiveStream,
      closeModal,
    } = this.props;
    stopLiveStream();
    closeModal();
  }

  handleClickEvent(ev, id) {
    // console.log('click', id);
    this.setState({ cid: id });
  }


  render() {
    const {
      intl, closeModal, current, streams,
    } = this.props;
    const { cid } = this.state;
    const startDisabled = !cid;
    const size = streams.length;
    console.log('streams.length', size);
    return (
      <Modal
        overlayClassName={styles.overlay}
        className={size <= 4 ? styles.modal1 : styles.modal4}
        onRequestClose={closeModal}
        contentLabel={intl.formatMessage(intlMessages.title)}
        hideBorder
        title={intl.formatMessage(intlMessages.title)}
      >
        <div className={styles.content}>

          <div className={styles.hoverGrid}>

            {streams.map((y, i) => (

              <div className={[styles.hoverGridItem, y.id === cid ? styles.activeGridItem : ''].join(' ')} key={y.id} onClick={ev => this.handleClickEvent(ev, y.id)}>
                <div className={styles.caption}>
                  <h3>{y.label}</h3>
                  <p>{y.description}</p>
                </div>
                <div className={styles.hoverGridImageDiv}>
                  <img
                    src={y.preview}
                    alt={y.label}
                    title={y.label}
                  />
                </div>

              </div>
            ))
            }


          </div>
          <div className={styles.buttonDiv}>
            <Button
              className={styles.startBtn}
              label={intl.formatMessage(intlMessages.start)}
              onClick={this.startWatchingHandler}
              disabled={startDisabled}
            />
            {current
              ? (
                <Button
                  className={styles.startBtn}
                  label={intl.formatMessage(intlMessages.stop)}
                  onClick={this.stopHandler}
                />
              ) : null}
          </div>
        </div>
      </Modal>
    );
  }
}

export default injectIntl(withModalMounter(LiveStreamModal));
