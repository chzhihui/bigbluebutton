

function parse_rtmp_url(rtmp_url) {
  // @see: http://stackoverflow.com/questions/10469575/how-to-use-location-object-to-parse-url-without-redirecting-the-page-in-javascri
  const a = document.createElement('a');
  a.href = rtmp_url.replace('rtmp://', 'http://')
    .replace('webrtc://', 'http://')
    .replace('rtc://', 'http://');

  let vhost = a.hostname;
  let app = a.pathname.substr(1, a.pathname.lastIndexOf('/') - 1);
  const stream = a.pathname.substr(a.pathname.lastIndexOf('/') + 1);

  // parse the vhost in the params of app, that srs supports.
  app = app.replace('...vhost...', '?vhost=');
  if (app.indexOf('?') >= 0) {
    const params = app.substr(app.indexOf('?'));
    app = app.substr(0, app.indexOf('?'));

    if (params.indexOf('vhost=') > 0) {
      vhost = params.substr(params.indexOf('vhost=') + 'vhost='.length);
      if (vhost.indexOf('&') > 0) {
        vhost = vhost.substr(0, vhost.indexOf('&'));
      }
    }
  }

  // when vhost equals to server, and server is ip,
  // the vhost is __defaultVhost__
  if (a.hostname === vhost) {
    const re = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    if (re.test(a.hostname)) {
      vhost = '__defaultVhost__';
    }
  }

  // parse the schema
  let schema = 'rtmp';
  if (rtmp_url.indexOf('://') > 0) {
    schema = rtmp_url.substr(0, rtmp_url.indexOf('://'));
  }

  let port = a.port;
  if (!port) {
    if (schema === 'http') {
      port = 80;
    } else if (schema === 'https') {
      port = 443;
    } else if (schema === 'rtmp') {
      port = 1935;
    }
  }

  const ret = {
    url: rtmp_url,
    schema,
    server: a.hostname,
    port,
    vhost,
    app,
    stream,
  };
  __fill_query(a.search, ret);

  // For webrtc API, we use 443 if page is https, or schema specified it.
  if (!ret.port) {
    if (schema === 'webrtc' || schema === 'rtc') {
      if (ret.user_query.schema === 'https') {
        ret.port = 443;
      } else if (window.location.href.indexOf('https://') === 0) {
        ret.port = 443;
      } else {
        ret.port = 80;
      }
    }
  }
  //ret.user_query.encrypt = true;
  //ret.user_query.dtls = true;
  let su = ret.url;
  const qidx = su.indexOf('?');
  if (qidx > 0) {
    su = su.substr(0, qidx);
  }
  ret.urlWithoutQuery = su;
  return ret;
  return ret;
}


function __fill_query(query_string, obj) {
  // pure user query object.
  obj.user_query = {};

  if (query_string.length === 0) {
    return;
  }

  // split again for angularjs.
  if (query_string.indexOf('?') >= 0) {
    query_string = query_string.split('?')[1];
  }

  const queries = query_string.split('&');
  for (let i = 0; i < queries.length; i++) {
    const elem = queries[i];

    const query = elem.split('=');
    obj[query[0]] = query[1];
    obj.user_query[query[0]] = query[1];
  }

  // alias domain for vhost.
  if (obj.domain) {
    obj.vhost = obj.domain;
  }
}

function SrsRtcPlayerAsync() {
  var self = {
    async play(apiUrl, streamUrl) {
      self.pc.addTransceiver('audio', { direction: 'recvonly' });
      self.pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await self.pc.createOffer();
      await self.pc.setLocalDescription(offer);
      const session = await new Promise(((resolve, reject) => {
        // @see https://github.com/rtcdn/rtcdn-draft
        const data = {
          api: apiUrl,
          streamurl: streamUrl,
          clientip: null,
          sdp: offer.sdp,
        };
        // console.log('Generated offer: ', data);
        HTTP.call('POST', `${apiUrl}`, {
          data,
        }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            const { data } = result;
            // console.log('Got answer: ', data);
            if (data.code) {
              reject(data);
              return;
            }
            resolve(data);
          }
        });
      }));
      await self.pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: session.sdp,
        }),
      );
      return session;
    },
    close() {
      self.pc.close();
    },
    // callbacks.
    onaddstream(event) {
    },
  };

  self.pc = new RTCPeerConnection(null);
  self.pc.onaddstream = function (event) {
    if (self.onaddstream) {
      self.onaddstream(event);
    }
  };
  return self;
}


// Build RTC api url.
function prepareUrl(url) {
  let apiUrl;


  let streamUrl;

  if (true) {
    var urlObject = parse_rtmp_url(url);

    // If user specifies the schema, use it as API schema.
    var schema = urlObject.schema;
    schema = schema ? `${schema}:` : window.location.protocol;

    var port = urlObject.port || 1985;
    if (schema === 'https:') {
      port = urlObject.port || 443;
    }

    // @see https://github.com/rtcdn/rtcdn-draft
    let api = urlObject.user_query.play || '/rtc/v1/play/';
    if (api.lastIndexOf('/') !== api.length - 1) {
      api += '/';
    }

    apiUrl = `${schema}//${urlObject.server}:${port}${api}`;
    for (const key in urlObject.user_query) {
      if (key !== 'api' && key !== 'play') {
        apiUrl += `&${key}=${urlObject.user_query[key]}`;
      }
    }
    // Replace /rtc/v1/play/&k=v to /rtc/v1/play/?k=v
    apiUrl = apiUrl.replace(`${api}&`, `${api}?`);

    streamUrl = urlObject.urlWithoutQuery;
  }

  return {
    apiUrl,
    streamUrl,
    schema,
    urlObject,
    port,
  };
}

function doPlay(player, ops) {
  // console.log(`url processed,${ops}`);
  const { videoElement } = player;
  const sdk = new SrsRtcPlayerAsync();
  const conf = prepareUrl(ops);
  videoElement.autoplay = true;
  sdk.onaddstream = function (event) {
    // console.log('Start play, event: ', event);
    videoElement.srcObject = event.stream;
  };

  sdk.play(conf.apiUrl, conf.streamUrl)
    .then((session) => {
      // console.log('session started', session);
      // eslint-disable-next-line max-len
      // var simulator = conf.schema + '//' + conf.urlObject.server + ':' + conf.port + '/rtc/v1/nack/';
      // $('#sessionid').html(session.sessionid);
      // $('#simulator-drop').attr('href', simulator + '?drop=1&username=' + session.sessionid);
    })
    .catch((reason) => {
      sdk.close();
      // $('#rtc_media_player').hide();
      console.error(reason);
    });
  player.sdk = sdk;
}

function SrsRtcPlayer(videoElement, processUrl) {
  const self = {
    sdk: null,
    videoElement,
    processUrl,
    stop() {
      if (this.sdk) {
        this.sdk.close();
      }
      this.sdk = null;
    },
    play(ops) {
      if (this.videoUrl && this.videoUrl.url == ops.url) {
        return;
      }
      this.videoUrl = ops;
      this.stop();
      const $this = this;
      if (this.processUrl) {
        this.processUrl(ops, url => doPlay($this, url));
      } else {
        doPlay(this, ops.url || ops);
      }
    },
  };
  return self;
}
export default SrsRtcPlayer;
