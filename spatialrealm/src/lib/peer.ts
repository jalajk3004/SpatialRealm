// Simple peer connection manager - only works on client side
class PeerService {
  private peer: RTCPeerConnection | null = null;

  constructor() {
    // Don't initialize anything in constructor to avoid SSR issues
  }

  private createPeerConnection(): RTCPeerConnection | null {
    // Only create RTCPeerConnection on the client side
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      return null;
    }

    const config = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    };

    return new RTCPeerConnection(config);
  }

  getInstance(): RTCPeerConnection | null {
    if (!this.peer) {
      this.peer = this.createPeerConnection();
    }
    return this.peer;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.getInstance();
    if (!pc) return null;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.getInstance();
    if (!pc) return null;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      return null;
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getInstance();
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(description));
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.getInstance();
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  close(): void {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
  }
}

export default new PeerService();
