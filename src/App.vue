<template>
  <div class="app">
    <header class="header">
      <h1>🎥 Mama Talk</h1>
      <p>Connect with your loved ones through video calls</p>
    </header>

    <!-- Join Room Screen -->
    <div v-if="!isConnected" class="join-screen">
      <div class="join-form">
        <h2>Join a Video Call</h2>

        <!-- Show room link if we have a roomId from URL -->
        <div v-if="roomIdFromUrl" class="room-link-display">
          <h3>You're joining room: {{ roomIdFromUrl }}</h3>
          <div class="link-container">
            <input :value="currentRoomUrl" readonly class="room-link-input" ref="roomLinkInput" />
            <button @click="copyRoomLink" class="copy-btn">
              {{ linkCopied ? '✓ Copied!' : 'Copy Link' }}
            </button>
          </div>
        </div>

        <div class="input-group">
          <label for="userName">Your Name</label>
          <input
            id="userName"
            v-model="userName"
            type="text"
            placeholder="Enter your name"
            @keyup.enter="joinRoom" />
        </div>

        <div v-if="!roomIdFromUrl" class="input-group">
          <label for="roomId">Room ID</label>
          <input
            id="roomId"
            v-model="roomId"
            type="text"
            placeholder="Enter room ID or create new"
            @keyup.enter="joinRoom" />
        </div>

        <button
          @click="joinRoom"
          :disabled="!userName || (!roomId && !roomIdFromUrl)"
          class="join-btn">
          Join Room
        </button>

        <button @click="testMediaAccess" class="test-media-btn"> Test Camera & Microphone </button>

        <div v-if="mediaStatus" class="media-status">
          {{ mediaStatus }}
        </div>

        <div v-if="!roomIdFromUrl" class="room-actions">
          <button @click="generateRoomId" class="generate-btn">Generate New Room</button>

          <!-- Show room link after generating -->
          <div v-if="roomId && !isConnected" class="room-link-display">
            <h3>Share this link:</h3>
            <div class="link-container">
              <input :value="currentRoomUrl" readonly class="room-link-input" ref="roomLinkInput" />
              <button @click="copyRoomLink" class="copy-btn">
                {{ linkCopied ? '✓ Copied!' : 'Copy Link' }}
              </button>
            </div>
            <button @click="openRoomInNewTab" class="open-room-btn"> Open in New Tab </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Call Screen -->
    <div v-if="isConnected" class="call-screen">
      <div class="video-container">
        <div class="local-video-wrapper">
          <video ref="localVideo" class="local-video" autoplay muted playsinline></video>
          <div class="video-label">You ({{ userName }})</div>
        </div>

        <div class="remote-videos">
          <div v-for="peer in remotePeers" :key="peer.userId" class="remote-video-wrapper">
            <video :data-user-id="peer.userId" class="remote-video" autoplay playsinline></video>
            <div class="video-label">{{ peer.userName }}</div>
          </div>
        </div>
      </div>

      <div class="controls">
        <button @click="toggleVideo" :class="{ active: isVideoOn }">
          {{ isVideoOn ? '📹' : '📷' }}
        </button>
        <button @click="toggleAudio" :class="{ active: isAudioOn }">
          {{ isAudioOn ? '🎤' : '🔇' }}
        </button>
        <button @click="shareRoom" class="share-btn"> 🔗 Share </button>
        <button @click="leaveRoom" class="leave-btn"> 📞 Leave </button>
      </div>

      <!-- Room Info -->
      <div class="room-info">
        <p>Room: {{ currentRoomId }} | Participants: {{ remotePeers.length + 1 }}</p>
        <button @click="copyRoomLink" class="mini-copy-btn">
          {{ linkCopied ? '✓' : '📋' }}
        </button>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="share-modal-overlay" @click="closeShareModal">
      <div class="share-modal" @click.stop>
        <h3>Share Room Link</h3>
        <div class="link-container">
          <input :value="currentRoomUrl" readonly class="room-link-input" />
          <button @click="copyRoomLink" class="copy-btn">
            {{ linkCopied ? '✓ Copied!' : 'Copy Link' }}
          </button>
        </div>
        <div class="share-actions">
          <button @click="openRoomInNewTab" class="open-room-btn">Open in New Tab</button>
          <button @click="closeShareModal" class="close-btn">Close</button>
        </div>
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
    // Reactive data
    const userName = ref('');
    const roomId = ref('');
    const isConnected = ref(false);
    const isVideoOn = ref(true);
    const isAudioOn = ref(true);
    const remotePeers = ref([]);
    const showShareModal = ref(false);
    const linkCopied = ref(false);
    const roomIdFromUrl = ref('');
    const mediaStatus = ref('');

    // Refs
    const localVideo = ref(null);
    const roomLinkInput = ref(null);

    // WebRTC and Socket.IO
    let socket = null;
    let localStream = null;
    const peerConnections = new Map();

    // WebRTC configuration
    const rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    // Computed properties
    const currentRoomId = computed(() => roomIdFromUrl.value || roomId.value);

    const currentRoomUrl = computed(() => {
      const baseUrl = window.location.origin;
      return `${baseUrl}/room/${currentRoomId.value}`;
    });

    // Initialize from URL
    onMounted(() => {
      const urlParts = window.location.pathname.split('/');
      if (urlParts[1] === 'room' && urlParts[2]) {
        roomIdFromUrl.value = urlParts[2];
        roomId.value = urlParts[2];
      }
    });

    // Generate random room ID
    const generateRoomId = () => {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      roomId.value = newRoomId;

      // Update URL
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', `/room/${newRoomId}`);
      }
    };

    // Test media access
    const testMediaAccess = async () => {
      try {
        console.log('Testing media access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        console.log('Media access successful:', stream);
        console.log('Video tracks:', stream.getVideoTracks());
        console.log('Audio tracks:', stream.getAudioTracks());

        // Stop the test stream
        stream.getTracks().forEach((track) => track.stop());

        alert('Camera and microphone access successful!');
      } catch (error) {
        console.error('Media access failed:', error);
        alert(
          `Media access failed: ${error.message}\n\nPlease:\n1. Allow camera and microphone permissions\n2. Make sure no other app is using your camera\n3. Try refreshing the page`,
        );
      }
    };

    // Copy room link to clipboard
    const copyRoomLink = async () => {
      try {
        await navigator.clipboard.writeText(currentRoomUrl.value);
        linkCopied.value = true;
        setTimeout(() => {
          linkCopied.value = false;
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
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

    // Open room in new tab
    const openRoomInNewTab = () => {
      window.open(currentRoomUrl.value, '_blank');
    };

    // Share room modal
    const shareRoom = () => {
      showShareModal.value = true;
    };

    const closeShareModal = () => {
      showShareModal.value = false;
    };

    // Initialize media stream
    const initializeMedia = async () => {
      try {
        mediaStatus.value = 'Requesting camera and microphone access...';
        console.log('Requesting media access...');

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

        mediaStatus.value = 'Media access granted!';
        console.log('Media stream obtained:', localStream);
        console.log('Video tracks:', localStream.getVideoTracks().length);
        console.log('Audio tracks:', localStream.getAudioTracks().length);

        if (localVideo.value) {
          localVideo.value.srcObject = localStream;
          console.log('Local video element assigned');
          mediaStatus.value = 'Local video ready!';
        } else {
          console.error('Local video element not found');
          mediaStatus.value = 'Error: Video element not found';
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        mediaStatus.value = `Error: ${error.message}`;
        alert(
          `Unable to access camera/microphone: ${error.message}. Please check permissions and ensure no other app is using your camera.`,
        );
        throw error;
      }
    };

    // Join room
    const joinRoom = async () => {
      const finalRoomId = roomIdFromUrl.value || roomId.value;
      if (!userName.value.trim() || !finalRoomId.trim()) return;

      try {
        await initializeMedia();

        // Wait a bit for video element to be ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Initialize Socket.IO
        socket = io('http://localhost:3000');

        socket.emit('join-room', {
          roomId: finalRoomId,
          userName: userName.value,
        });

        // Socket event handlers
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

        // Update URL to room URL
        if (!roomIdFromUrl.value && window.history && window.history.pushState) {
          window.history.pushState({}, '', `/room/${finalRoomId}`);
        }
      } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
      }
    };

    // Create peer connection
    const createPeerConnection = async (userId, peerUserName, shouldCreateOffer) => {
      console.log(
        'Creating peer connection for:',
        userId,
        peerUserName,
        'shouldCreateOffer:',
        shouldCreateOffer,
      );

      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnections.set(userId, peerConnection);

      // Add local stream to peer connection
      if (localStream) {
        console.log('Adding local stream tracks to peer connection');
        localStream.getTracks().forEach((track) => {
          console.log('Adding track:', track.kind, track.enabled);
          peerConnection.addTrack(track, localStream);
        });
      } else {
        console.error('No local stream available when creating peer connection');
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track from:', userId, event);
        const [remoteStream] = event.streams;
        console.log('Remote stream:', remoteStream);

        // Add peer to list if not already there
        if (!remotePeers.value.find((p) => p.userId === userId)) {
          remotePeers.value.push({
            userId,
            userName: peerUserName,
            stream: remoteStream,
          });
          console.log('Added peer to list:', userId, peerUserName);
        }

        // Set video source with multiple attempts
        let attempts = 0;
        const assignVideo = () => {
          const videoElement = document.querySelector(`[data-user-id="${userId}"]`);
          console.log('Looking for video element:', `[data-user-id="${userId}"]`, videoElement);

          if (videoElement) {
            videoElement.srcObject = remoteStream;
            console.log('Assigned remote stream to video element for user:', userId);
          } else if (attempts < 10) {
            attempts++;
            console.log(`Video element not found for ${userId}, attempt ${attempts}/10`);
            setTimeout(assignVideo, 200);
          } else {
            console.error('Failed to find video element after 10 attempts for user:', userId);
          }
        };

        setTimeout(assignVideo, 100);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetUserId: userId,
          });
        }
      };

      if (shouldCreateOffer) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', {
          offer,
          targetUserId: userId,
        });
      }
    };

    // Handle offer
    const handleOffer = async (offer, fromUserId, fromUserName) => {
      if (!peerConnections.has(fromUserId)) {
        await createPeerConnection(fromUserId, fromUserName, false);
      }

      const peerConnection = peerConnections.get(fromUserId);
      await peerConnection.setRemoteDescription(offer);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', {
        answer,
        targetUserId: fromUserId,
      });
    };

    // Handle answer
    const handleAnswer = async (answer, fromUserId) => {
      const peerConnection = peerConnections.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (candidate, fromUserId) => {
      const peerConnection = peerConnections.get(fromUserId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    };

    // Remove peer connection
    const removePeerConnection = (userId) => {
      const peerConnection = peerConnections.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnections.delete(userId);
      }

      remotePeers.value = remotePeers.value.filter((peer) => peer.userId !== userId);
    };

    // Toggle video
    const toggleVideo = () => {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          isVideoOn.value = videoTrack.enabled;
        }
      }
    };

    // Toggle audio
    const toggleAudio = () => {
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          isAudioOn.value = audioTrack.enabled;
        }
      }
    };

    // Leave room
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

      // Navigate back to home
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/');
      }

      // Reset room IDs
      roomIdFromUrl.value = '';
      roomId.value = '';
    };

    // Cleanup on unmount
    onUnmounted(() => {
      leaveRoom();
    });

    return {
      userName,
      roomId,
      isConnected,
      isVideoOn,
      isAudioOn,
      remotePeers,
      localVideo,
      showShareModal,
      linkCopied,
      roomIdFromUrl,
      mediaStatus,
      currentRoomId,
      currentRoomUrl,
      roomLinkInput,
      generateRoomId,
      joinRoom,
      testMediaAccess,
      toggleVideo,
      toggleAudio,
      leaveRoom,
      copyRoomLink,
      openRoomInNewTab,
      shareRoom,
      closeShareModal,
    };
  },
};
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  text-align: center;
  padding: 2rem;
  color: white;
}

.header h1 {
  font-size: 2.5rem;
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

.test-media-btn {
  width: 100%;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
  background: #ffc107;
  color: #212529;
}

.test-media-btn:hover {
  background: #ffca2c;
}

.media-status {
  margin: 1rem 0;
  padding: 0.5rem;
  background: #e9ecef;
  border-radius: 0.25rem;
  font-size: 0.9rem;
  text-align: center;
  color: #495057;
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
  background: #218838;
}

.open-room-btn {
  width: 100%;
  padding: 0.5rem;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  transition: background-color 0.3s;
}

.open-room-btn:hover {
  background: #138496;
}

.room-actions {
  margin-top: 1rem;
}

.call-screen {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.video-container {
  flex: 1;
  display: grid;
  gap: 1rem;
  padding: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-content: center;
}

.local-video-wrapper,
.remote-video-wrapper {
  position: relative;
  background: #000;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.local-video,
.remote-video {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

.video-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 0.5rem 1rem;
  font-weight: 600;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.1);
}

.controls button {
  padding: 1rem;
  border: none;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transition: all 0.3s;
  width: 60px;
  height: 60px;
}

.controls button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.controls button.active {
  background: #28a745;
}

.share-btn {
  background: #17a2b8 !important;
}

.share-btn:hover {
  background: #138496 !important;
}

.leave-btn {
  background: #dc3545 !important;
}

.leave-btn:hover {
  background: #c82333 !important;
}

.room-info {
  position: fixed;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mini-copy-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.3s;
}

.mini-copy-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-modal {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
}

.share-modal h3 {
  margin: 0 0 1rem 0;
  color: #333;
  text-align: center;
}

.share-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.close-btn {
  flex: 1;
  padding: 0.75rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.close-btn:hover {
  background: #5a6268;
}

/* Responsive design */
@media (max-width: 768px) {
  .video-container {
    grid-template-columns: 1fr;
  }

  .controls {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .controls button {
    width: 50px;
    height: 50px;
    font-size: 1.2rem;
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

  .share-actions {
    flex-direction: column;
  }
}
</style>
