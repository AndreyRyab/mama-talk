# Mama Talk - Video Calling App

A real-time video calling application built with WebRTC, Socket.IO, and Vue 3.

## Features

- 🎥 Real-time video and audio calling
- 🏠 Room-based communication
- 📱 Responsive design for mobile and desktop
- 🎛️ Video/Audio controls
- 👥 Multiple participants support

## Technology Stack

- **Frontend**: Vue 3, Vite
- **Backend**: Node.js, Express, Socket.IO
- **WebRTC**: Real-time peer-to-peer communication
- **Styling**: CSS3 with modern design

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Modern web browser with WebRTC support

### Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start both frontend and backend:

   ```bash
   npm run dev
   ```

   This will start:

   - Backend server on http://localhost:3000
   - Frontend development server on http://localhost:5173

2. Open your browser and navigate to http://localhost:5173

### Manual Setup (Alternative)

If you prefer to run frontend and backend separately:

1. Start the backend server:

   ```bash
   npm run server
   ```

2. In another terminal, start the frontend:
   ```bash
   npm run client
   ```

## How to Use

1. **Join a Room**:

   - Enter your name
   - Enter a room ID (or generate a new one)
   - Click "Join Room"

2. **Share the Room**:

   - Share the room ID with others
   - They can join using the same room ID

3. **During the Call**:
   - Toggle video/audio using control buttons
   - Leave the room when done

## Browser Permissions

The app requires access to your camera and microphone. Make sure to:

- Allow camera and microphone permissions when prompted
- Use HTTPS in production for WebRTC to work properly

## Architecture

### Backend (server.js)

- Express.js server for serving static files
- Socket.IO for real-time communication
- Room management and user tracking
- WebRTC signaling server

### Frontend (Vue 3)

- Modern Vue 3 composition API
- WebRTC peer connections management
- Responsive UI with video controls
- Real-time chat functionality

## Deployment

For production deployment:

1. Build the frontend:

   ```bash
   npm run build
   ```

2. Set NODE_ENV to production:

   ```bash
   export NODE_ENV=production
   ```

3. Start the server:
   ```bash
   node server.js
   ```

## Troubleshooting

### Common Issues

1. **Camera/Microphone not working**:

   - Check browser permissions
   - Ensure HTTPS in production
   - Try refreshing the page

2. **Connection issues**:

   - Check firewall settings
   - Ensure ports 3000 and 5173 are available
   - Try a different browser

3. **Video not showing**:
   - Check WebRTC support in browser
   - Verify network connectivity
   - Look at browser console for errors

### Browser Support

- Chrome (recommended)
- Firefox
- Safari (latest versions)
- Edge

## Development

### Project Structure

```
mama-talk/
├── src/
│   ├── App.vue          # Main Vue component
│   └── main.js          # Vue app entry point
├── server.js            # Backend server
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── index.html           # HTML template
```

### Adding Features

The codebase is structured to easily add new features:

- WebRTC logic is contained in the Vue component
- Socket.IO events are handled in both frontend and backend
- UI is componentized and responsive

## License

This project is open source and available under the MIT License.
