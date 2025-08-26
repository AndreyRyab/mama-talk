<template>
  <div class="app">
    <header class="header">
      <h1>mam@Talk</h1>
    </header>

    <div v-if="!isConnected" class="join-screen">
      <div class="join-form">
        <h2>Call your mom</h2>

        <div v-if="!roomIdFromUrl" class="room-actions">
          <button @click="generateRoomId" class="generate-btn">Generate link</button>

          <div v-if="roomId && !isConnected" class="room-link-display">
            <h3>Send this link to your mom:</h3>
            <div class="link-container">
              <input :value="currentRoomUrl" readonly class="room-link-input" ref="roomLinkInput" />
              <button @click="copyRoomLink" class="copy-btn">
                {{ linkCopied ? '✓ Copied!' : 'Copy' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="roomIdFromUrl" class="room-link-display">
          <h3>You're joining room: {{ roomIdFromUrl }}</h3>
          <div class="link-container">
            <input :value="currentRoomUrl" readonly class="room-link-input" ref="roomLinkInput" />
            <button @click="copyRoomLink" class="copy-btn">
              {{ linkCopied ? '✓ Copied!' : 'Copy Link' }}
            </button>
          </div>
        </div>

        <button @click="joinRoom" :disabled="!roomId && !roomIdFromUrl" class="join-btn">
          Join call
        </button>
      </div>
    </div>

    <div v-if="isConnected" class="call-screen">
      <div class="video-container">
        <div class="remote-videos">
          <div v-for="peer in remotePeers" :key="peer.userId" class="remote-video-wrapper">
            <video :data-user-id="peer.userId" class="remote-video" autoplay playsinline></video>
          </div>
        </div>

        <div class="local-video-wrapper">
          <video ref="localVideo" class="local-video" autoplay muted playsinline></video>
        </div>
      </div>

      <div class="controls">
        <button @click="toggleVideo" :class="{ active: isVideoOn }">
          {{ isVideoOn ? '🚫' : '🎥' }}
        </button>
        <button @click="leaveRoom" class="leave-btn"> 📞 </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { io } from 'socket.io-client';

export default {
  name: 'App',
  setup() {
    const userName = ref('');
    const roomId = ref('');
    const isConnected = ref(false);
    const isVideoOn = ref(true);
    const remotePeers = ref([]);
    const linkCopied = ref(false);
    const roomIdFromUrl = ref('');

    const localVideo = ref(null);
    const roomLinkInput = ref(null);

    let socket = null;
    let localStream = null;
    const peerConnections = new Map();

    const rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };

    const currentRoomId = computed(() => roomIdFromUrl.value || roomId.value);

    const currentRoomUrl = computed(() => {
      const baseUrl = window.location.origin;
      return `${baseUrl}/room/${currentRoomId.value}`;
    });

    const generateRandomName = () => {
      const adjectives = [
        'Happy',
        'Sunny',
        'Clever',
        'Brave',
        'Gentle',
        'Bright',
        'Swift',
        'Kind',
        'Cool',
        'Smart',
      ];
      const nouns = [
        'Fox',
        'Eagle',
        'Lion',
        'Dolphin',
        'Tiger',
        'Bear',
        'Wolf',
        'Rabbit',
        'Owl',
        'Hawk',
      ];
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const number = Math.floor(Math.random() * 100);
      return `${adjective}${noun}${number}`;
    };

    onMounted(() => {
      userName.value = generateRandomName();

      const urlParts = window.location.pathname.split('/');
      if (urlParts[1] === 'room' && urlParts[2]) {
        roomIdFromUrl.value = urlParts[2];
        roomId.value = urlParts[2];
        setTimeout(() => {
          joinRoom();
        }, 100);
      }
    });

    const generateRoomId = () => {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      roomId.value = newRoomId;

      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', `/room/${newRoomId}`);
      }
    };

    const copyRoomLink = async () => {
      try {
        await navigator.clipboard.writeText(currentRoomUrl.value);
        linkCopied.value = true;
        setTimeout(() => {
          linkCopied.value = false;
        }, 2000);
      } catch (err) {
        const input = roomLinkInput.value;
        if (input) {
          input.select();
          document.execCommand('copy');
          linkCopied.value = true;
          setTimeout(() => {
            linkCopied.value = false;
          }, 2000);
        }
      }
    };

    const initializeMedia = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        await nextTick();

        if (localVideo.value) {
          localVideo.value.srcObject = localStream;

          localVideo.value.onloadedmetadata = () => {
            localVideo.value.play().catch(console.error);
          };
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert(
          `Unable to access camera/microphone: ${error.message}. Please check permissions and ensure no other app is using your camera.`,
        );
        throw error;
      }
    };

    const joinRoom = async () => {
      const finalRoomId = roomIdFromUrl.value || roomId.value;
      if (!finalRoomId.trim()) return;

      if (!userName.value.trim()) {
        userName.value = generateRandomName();
      }

      try {
        await initializeMedia();

        await nextTick();
        if (localVideo.value && localStream) {
          localVideo.value.srcObject = localStream;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        const socketUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';

        socket = io(socketUrl);

        socket.emit('join-room', {
          roomId: finalRoomId,
          userName: userName.value,
        });

        socket.on('existing-users', async (users) => {
          for (const user of users) {
            await createPeerConnection(user.userId, user.userName, true);
          }
        });

        socket.on('user-joined', async ({ userId, userName: newUserName }) => {
          await createPeerConnection(userId, newUserName, false);
        });

        socket.on('user-left', ({ userId }) => {
          removePeerConnection(userId);
        });

        socket.on('offer', async ({ offer, fromUserId, fromUserName }) => {
          await handleOffer(offer, fromUserId, fromUserName);
        });

        socket.on('answer', async ({ answer, fromUserId }) => {
          await handleAnswer(answer, fromUserId);
        });

        socket.on('ice-candidate', async ({ candidate, fromUserId }) => {
          await handleIceCandidate(candidate, fromUserId);
        });

        isConnected.value = true;

        setTimeout(() => {
          if (localVideo.value && localStream && !localVideo.value.srcObject) {
            localVideo.value.srcObject = localStream;
            localVideo.value.play().catch(console.error);
          }
        }, 1000);

        if (!roomIdFromUrl.value && window.history && window.history.pushState) {
          window.history.pushState({}, '', `/room/${finalRoomId}`);
        }
      } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
      }
    };

    const createPeerConnection = async (userId, peerUserName, shouldCreateOffer) => {
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnections.set(userId, peerConnection);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });
      }

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;

        if (!remotePeers.value.find((p) => p.userId === userId)) {
          remotePeers.value.push({
            userId,
            userName: peerUserName,
            stream: remoteStream,
          });
        }

        let attempts = 0;
        const assignVideo = () => {
          const videoElement = document.querySelector(`[data-user-id="${userId}"]`);

          if (videoElement) {
            videoElement.srcObject = remoteStream;
          } else if (attempts < 10) {
            attempts++;
            setTimeout(assignVideo, 200);
          }
        };

        nextTick(() => {
          setTimeout(assignVideo, 100);
        });
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetUserId: userId,
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
          peerConnection.restartIce();
        }
      };

      if (shouldCreateOffer) {
        const offer = await peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true,
        });
        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', {
          offer,
          targetUserId: userId,
        });
      }
    };

    const handleOffer = async (offer, fromUserId, fromUserName) => {
      if (!peerConnections.has(fromUserId)) {
        await createPeerConnection(fromUserId, fromUserName, false);
      }

      const peerConnection = peerConnections.get(fromUserId);
      await peerConnection.setRemoteDescription(offer);

      const answer = await peerConnection.createAnswer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', {
        answer,
        targetUserId: fromUserId,
      });
    };

    const handleAnswer = async (answer, fromUserId) => {
      const peerConnection = peerConnections.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    };

    const handleIceCandidate = async (candidate, fromUserId) => {
      const peerConnection = peerConnections.get(fromUserId);
      if (peerConnection && peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    const removePeerConnection = (userId) => {
      const peerConnection = peerConnections.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnections.delete(userId);
      }

      remotePeers.value = remotePeers.value.filter((peer) => peer.userId !== userId);
    };

    const toggleVideo = () => {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          isVideoOn.value = videoTrack.enabled;
        }
      }
    };

    const leaveRoom = () => {
      if (socket) {
        socket.disconnect();
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();

      remotePeers.value = [];
      isConnected.value = false;

      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/');
      }

      roomIdFromUrl.value = '';
      roomId.value = '';
    };

    onUnmounted(() => {
      leaveRoom();
    });

    return {
      userName,
      roomId,
      isConnected,
      isVideoOn,
      remotePeers,
      localVideo,
      linkCopied,
      roomIdFromUrl,
      currentRoomId,
      currentRoomUrl,
      roomLinkInput,
      socket: computed(() => socket),
      generateRoomId,
      joinRoom,
      toggleVideo,
      leaveRoom,
      copyRoomLink,
    };
  },
};
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
}

.header {
  padding: 1.5rem 1rem 1rem;
  text-align: center;
  color: white;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.join-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.join-form {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 500px;
}

.join-form h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #555;
}

.input-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
}

.join-btn,
.generate-btn {
  width: 100%;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.join-btn {
  background: #667eea;
  color: white;
}

.join-btn:hover:not(:disabled) {
  background: #5a6fd8;
}

.join-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.generate-btn {
  background: #f8f9fa;
  color: #333;
  border: 2px solid #e1e5e9;
}

.generate-btn:hover {
  background: #e9ecef;
}

.room-link-display {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  border: 2px solid #e1e5e9;
}

.room-link-display h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.link-container {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.room-link-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  background: white;
  font-size: 0.9rem;
}

.copy-btn {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.copy-btn:hover {
  background: #88217e;
}

.room-actions {
  margin-top: 1rem;
}

.call-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100vh;
}

.video-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  align-items: center;
}

.local-video-wrapper {
  position: absolute;
  top: 0;
  right: 2rem;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  width: 200px;
  z-index: 10;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.remote-videos {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  width: 100%;
  max-width: 1200px;
}

.remote-video-wrapper {
  position: relative;
  background: #000;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  aspect-ratio: 1 / 1;
}

.local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 1rem 1rem 2rem;
}

.controls button {
  padding: 1rem;
  border: none;
  border-radius: 40%;
  font-size: 48px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transition: all 0.3s;
  width: 100px;
  height: 100px;
}

.controls button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

button.leave-btn {
  background: #be4bd2;
}

button.leave-btn:hover {
  background: #be4bd2;
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .local-video-wrapper {
    width: 120px;
    height: 120px;
    right: 1rem;
  }

  .remote-videos {
    grid-template-columns: 1fr;
  }

  .remote-video {
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .join-form {
    margin: 1rem;
    padding: 1.5rem;
  }

  .link-container {
    flex-direction: column;
  }

  .copy-btn {
    width: 100%;
  }
}
</style>
