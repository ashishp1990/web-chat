import React, { useEffect, useRef, useState } from 'react';

const VideoCall = ({ data, socket, onClose, currentUser }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(data.isCaller);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);
  const isCaller = data.isCaller;
  const caller = data.from;
  const receiver = data.to;
  const remoteUser = isCaller ? receiver : caller;

  // Timer effect
  useEffect(() => {
    if (callAccepted) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [callAccepted]);

  const formatTime = (s) => {
    const mins = String(Math.floor(s / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const setupConnection = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setStream(localStream);
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

    peerRef.current = new RTCPeerConnection();

    localStream.getTracks().forEach(track => {
      peerRef.current.addTrack(track, localStream);
    });

    peerRef.current.ontrack = event => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerRef.current.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: remoteUser,
          from: currentUser.name,
        });
      }
    };
  };

  const handleAccept = async () => {
    await setupConnection();
    setCallAccepted(true);
  };

  const handleReject = () => {
    socket.emit('end_call', { to: remoteUser });
    onClose();
  };

  const endCall = () => {
    socket.emit('end_call', { to: remoteUser });
    peerRef.current?.close();
    stream?.getTracks().forEach(track => track.stop());
    onClose();
  };

  useEffect(() => {
    if (callAccepted) {
      (async () => {
        await setupConnection();

        if (isCaller) {
          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          socket.emit('video-offer', {
            offer,
            from: currentUser.name,
            to: remoteUser
          });
        }
      })();
    }
  }, [callAccepted]);

  useEffect(() => {
    socket.on('video-offer', async ({ offer, from }) => {
      if (!peerRef.current) {
        await setupConnection();
      }

      await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit('video-answer', {
        answer,
        from: currentUser.name,
        to: from
      });
    });

    socket.on('video-answer', async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    socket.on('end_call', () => {
      endCall();
    });

    return () => {
      socket.off('video-offer');
      socket.off('video-answer');
      socket.off('ice-candidate');
      socket.off('end_call');
      peerRef.current?.close();
      stream?.getTracks().forEach(track => track.stop());
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 text-white flex flex-col items-center justify-center z-50">
      <h2 className="text-xl font-bold mb-2">Video Call with <span className="text-green-400">{remoteUser}</span></h2>
      {callAccepted && <p className="mb-4">Call Duration: {formatTime(timer)}</p>}

      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <video ref={localVideoRef} autoPlay muted className="w-64 h-48 bg-gray-800 rounded" />
          <span>{currentUser.name} (You)</span>
        </div>
        <div className="flex flex-col items-center">
          <video ref={remoteVideoRef} autoPlay className="w-64 h-48 bg-gray-800 rounded" />
          <span>{remoteUser}</span>
        </div>
      </div>

      {!callAccepted && !isCaller && (
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleAccept}
            className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      )}

      <button
        onClick={endCall}
        className="mt-6 bg-red-600 px-4 py-2 rounded hover:bg-red-700"
      >
        End Call
      </button>
    </div>
  );
};

export default VideoCall;
