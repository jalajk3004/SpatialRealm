"use client"

import {io, Socket} from "socket.io-client";

class SocketClient {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect(userId: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.socket!;
    }

    this.isConnecting = true;
    
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    // Create new socket with auth
    this.socket = io(`${process.env.BACKEND_URL}`||"https://spatialrealm.onrender.com/", {
      transports: ["websocket"],
      auth: {
        userId: userId
      },
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.isConnecting = false;
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Export singleton instance
const socketClient = new SocketClient();

// Create a socket object that mimics the original interface
export const socket = {
  connect: (userId: string) => socketClient.connect(userId),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit: (...args: [event: string, ...args: any[]]) => {
    const currentSocket = socketClient.getSocket();
    if (currentSocket) {
      return currentSocket.emit(...args);
    }
    console.warn('Socket not connected');
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (...args: [event: string, listener: (...args: any[]) => void]) => {
    const currentSocket = socketClient.getSocket();
    if (currentSocket) {
      return currentSocket.on(...args);
    }
    console.warn('Socket not connected');
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off: (...args: any[]) => {
    const currentSocket = socketClient.getSocket();
    if (currentSocket) {
      return currentSocket.off(...args);
    }
    console.warn('Socket not connected');
  },
  disconnect: () => socketClient.disconnect(),
  get connected() {
    return socketClient.getSocket()?.connected || false;
  },
  get id() {
    return socketClient.getSocket()?.id;
  }
};

// Also export socketClient for advanced usage
export { socketClient };
