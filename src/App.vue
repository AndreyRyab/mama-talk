<template>
  <div class="app">
    <header class="header">
      <h1>mam@Talk</h1>
    </header>

    <!-- Join Room Screen -->
    <div v-if="!isConnected" class="join-screen">
      <div class="join-form">
        <h2>Call your mom</h2>

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

        <button @click="joinRoom" :disabled="!roomId && !roomIdFromUrl" class="join-btn">
          Join call
        </button>

        <div v-if="!roomIdFromUrl" class="room-actions">
          <button @click="generateRoomId" class="generate-btn">Generate link</button>

          <!-- Show room link after generating -->
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
      </div>
    </div>

    <!-- Video Call Screen -->
    <div v-if="isConnected" class="call-screen">
      <div class="video-container">
        <!-- Remote videos (larger) -->
        <div class="remote-videos">
          <div v-for="peer in remotePeers" :key="peer.userId" class="remote-video-wrapper">
            <video :data-user-id="peer.userId" class="remote-video" autoplay playsinline></video>
            <div class="video-label">{{ peer.userName }}</div>
          </div>
        </div>

        <!-- My video (smaller, positioned as overlay in upper right) -->
        <div class="local-video-wrapper">
          <video ref="localVideo" class="local-video" autoplay muted playsinline></video>
          <div class="video-label">You ({{ userName }})</div>
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
    // Reactive data
    const userName = ref('');
    const roomId = ref('');
    const isConnected = ref(false);
    const isVideoOn = ref(true);
    const remotePeers = ref([]);
    const linkCopied = ref(false);
    const roomIdFromUrl = ref('');

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

    // Generate random user name
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

    // Initialize from URL
    onMounted(() => {
      // Generate random name on mount
      userName.value = generateRandomName();

      const urlParts = window.location.pathname.split('/');
      if (urlParts[1] === 'room' && urlParts[2]) {
        roomIdFromUrl.value = urlParts[2];
        roomId.value = urlParts[2];
        // Auto-join room if coming from URL
        setTimeout(() => {
          joinRoom();
        }, 100);
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

    // Initialize media stream
    const initializeMedia = async () => {
      try {
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

        console.log('Media stream obtained:', localStream);
        console.log('Video tracks:', localStream.getVideoTracks().length);
        console.log('Audio tracks:', localStream.getAudioTracks().length);

        // Use nextTick to ensure the video element is ready
        await nextTick();

        if (localVideo.value) {
          localVideo.value.srcObject = localStream;
          console.log('Local video element assigned');

          // Wait for video to load and play
          localVideo.value.onloadedmetadata = () => {
            localVideo.value.play().catch(console.error);
            console.log('Local video playing');
          };
        } else {
          console.error('Local video element not found');
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert(
          `Unable to access camera/microphone: ${error.message}. Please check permissions and ensure no other app is using your camera.`,
        );
        throw error;
      }
    };

    // Join room
    const joinRoom = async () => {
      const finalRoomId = roomIdFromUrl.value || roomId.value;
      if (!finalRoomId.trim()) return;

      // Generate new name if empty (shouldn't happen but safety check)
      if (!userName.value.trim()) {
        userName.value = generateRandomName();
      }

      try {
        await initializeMedia();

        // Ensure local video is properly connected after joining
        await nextTick();
        if (localVideo.value && localStream) {
          localVideo.value.srcObject = localStream;
          console.log('Re-assigning local video after join');
        }

        // Wait a bit for video element to be ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Initialize Socket.IO
        const socketUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';

        socket = io(socketUrl);

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

        // Final check to ensure local video is working
        setTimeout(() => {
          if (localVideo.value && localStream && !localVideo.value.srcObject) {
            console.log('Final attempt to connect local video');
            localVideo.value.srcObject = localStream;
            localVideo.value.play().catch(console.error);
          }
        }, 1000);

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
      remotePeers,
      localVideo,
      linkCopied,
      roomIdFromUrl,
      currentRoomId,
      currentRoomUrl,
      roomLinkInput,
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
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
}

.header {
  text-align: center;
  padding: 2rem 1rem;
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
  position: relative; /* Make container relative for absolute positioning */
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  align-items: center;
}

.local-video-wrapper {
  position: absolute; /* Position as overlay */
  top: 0; /* Position near top of container */
  right: 2rem; /* Position on right side */
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  width: 200px; /* Smaller width for local video */
  z-index: 10; /* Ensure it's above remote videos */
  border: 2px solid rgba(255, 255, 255, 0.3); /* Add subtle border to distinguish overlay */
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
  aspect-ratio: 1 / 1; /* Make wrapper square */
}

.local-video {
  width: 100%;
  height: 150px; /* Smaller height for local video */
  object-fit: cover;
}

.remote-video {
  width: 100%;
  height: 100%; /* Fill the square container */
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
  gap: 2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.1);
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

.controls button.active {
  background: #28a745;
}

.leave-btn {
  background: #dc3545 !important;
}

.leave-btn:hover {
  background: #c82333 !important;
}

/* Responsive design */
@media (max-width: 768px) {
  .local-video-wrapper {
    width: 120px; /* Even smaller on mobile */
    right: 1rem; /* Less margin on mobile */
  }

  .local-video {
    height: 80px; /* Smaller height on mobile */
  }

  .remote-videos {
    grid-template-columns: 1fr;
  }

  .remote-video {
    height: auto; /* Let aspect-ratio handle height on mobile */
    aspect-ratio: 1 / 1; /* Keep square on mobile */
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
