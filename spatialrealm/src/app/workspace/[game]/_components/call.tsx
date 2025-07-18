"use client";

import { useRoom } from "./useRoomContext";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BsFillCameraVideoFill, BsFillCameraVideoOffFill } from "react-icons/bs";
import { BsMicMuteFill } from "react-icons/bs";
import { FaMicrophone } from "react-icons/fa";
import { HiDesktopComputer } from "react-icons/hi";
import { IoClose, IoExpand, IoContract } from "react-icons/io5";

export const Call = () => {
  const { 
    localStream,
    remoteStreams,
    isConnected,
    error,
    peerId,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    screenShareStreams
  } = useRoom();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [selectedScreenShare, setSelectedScreenShare] = useState<{ stream: MediaStream; peerId: string; isOwn: boolean } | null>(null);
  const [isModalFullscreen, setIsModalFullscreen] = useState(true);
  const [showScreenShareNotification, setShowScreenShareNotification] = useState(false);
  const [availableScreenShares, setAvailableScreenShares] = useState<Array<{ stream: MediaStream; peerId: string; isOwn: boolean }>>([]);

  // Audio/Video controls
  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch (error) {
        console.error('Failed to start screen share:', error);
      }
    }
  };

  // Screen share modal controls
  const openScreenShareModal = useCallback((screenShare: { stream: MediaStream; peerId: string; isOwn: boolean }) => {
    setSelectedScreenShare(screenShare);
    setIsModalFullscreen(true);
  }, []);

  const closeScreenShareModal = useCallback(() => {
    setSelectedScreenShare(null);
    setIsModalFullscreen(false);
  }, []);

  const toggleModalFullscreen = () => {
    setIsModalFullscreen(!isModalFullscreen);
  };

  // Prepare streams for rendering
  const allStreams = localStream ? [localStream, ...remoteStreams] : remoteStreams;
  const validStreams = allStreams.filter(stream => stream && stream.active);

  // Convert screen share streams Map to Array
  const screenShareArray = useMemo(() => {
    return Array.from(screenShareStreams.entries()).map(([peerId, data]) => ({
      ...data
    }));
  }, [screenShareStreams]);

  // Handle screen share state changes
  useEffect(() => {
    const currentScreenShares = Array.from(screenShareStreams.entries()).map(([peerId, data]) => ({
      ...data
    }));
    
    setAvailableScreenShares(currentScreenShares);
    
    const ownScreenShare = currentScreenShares.find(share => share.isOwn);
    const otherScreenShares = currentScreenShares.filter(share => !share.isOwn);
    const hasOwnShare = ownScreenShare !== undefined;
    const hasOtherShares = otherScreenShares.length > 0;
    
    // Auto-open modal for screen sharer
    if (hasOwnShare && !selectedScreenShare) {
      setSelectedScreenShare(ownScreenShare);
      setIsModalFullscreen(true);
    }
    // Close modal if user stops sharing their screen
    else if (!hasOwnShare && selectedScreenShare?.isOwn) {
      setSelectedScreenShare(null);
      setIsModalFullscreen(false);
    }
    
    // Handle notifications for viewers
    if (hasOtherShares && !selectedScreenShare && !hasOwnShare) {
      setShowScreenShareNotification(true);
    } else if (!hasOtherShares) {
      setShowScreenShareNotification(false);
      // Close modal if viewing someone else's screen and they stopped sharing
      if (selectedScreenShare && !selectedScreenShare.isOwn) {
        setSelectedScreenShare(null);
        setIsModalFullscreen(false);
      }
    }
  }, [screenShareStreams, selectedScreenShare?.peerId, selectedScreenShare?.isOwn]);

  // Error state
  if (error) {
    return (
      <div className="fixed top-4 left-4 w-[calc(100vw-320px-48px)] h-[25vh] bg-red-100 rounded-xl shadow-2xl overflow-hidden border border-red-200 p-4 flex items-center justify-center">
        <div className="text-red-600 text-center">
          <h3 className="font-semibold mb-2">Connection Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Connecting state
  if (!isConnected) {
    return (
      <div className="fixed top-4 left-4 w-[calc(100vw-320px-48px)] h-[25vh] bg-blue-100 rounded-xl shadow-2xl overflow-hidden border border-blue-200 p-4 flex items-center justify-center">
        <div className="text-blue-600 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Connecting to video call...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen Share Notification for Viewers */}
      {showScreenShareNotification && !selectedScreenShare && (
        <div className="fixed top-4 right-4 z-40 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-xl shadow-2xl border border-blue-400 max-w-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <HiDesktopComputer size={24} className="text-blue-200" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Screen Share Available</h3>
              <p className="text-xs text-blue-100 mb-3">
                {availableScreenShares.filter(s => !s.isOwn).length} user(s) sharing their screen
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const firstOtherScreenShare = availableScreenShares.find(s => !s.isOwn);
                    if (firstOtherScreenShare) {
                      openScreenShareModal(firstOtherScreenShare);
                      setShowScreenShareNotification(false);
                    }
                  }}
                  className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
                >
                  View Screen
                </button>
                <button
                  onClick={() => setShowScreenShareNotification(false)}
                  className="px-3 py-1 bg-blue-700 text-white rounded-lg text-xs font-medium hover:bg-blue-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowScreenShareNotification(false)}
              className="flex-shrink-0 text-blue-200 hover:text-white transition-colors"
            >
              <IoClose size={18} />
            </button>
          </div>
        </div>
      )}
      
      {/* Screen Share Modal */}
      {selectedScreenShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Background Overlay */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg transition-all duration-300"
            onClick={closeScreenShareModal}
          />
          
          {/* Modal Content */}
          <div className={`relative ${isModalFullscreen ? 'w-full h-full' : 'w-[90vw] h-[85vh] max-w-7xl'} bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-blue-500 transition-all duration-300`}>
            {/* Modal Header */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <HiDesktopComputer size={20} />
                  <span className="font-semibold">
                    {selectedScreenShare.isOwn ? "Your Screen Share" : `${selectedScreenShare.peerId}'s Screen Share`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Fullscreen Toggle */}
                  <button
                    onClick={toggleModalFullscreen}
                    className="p-2 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg transition-colors"
                    title={isModalFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isModalFullscreen ? <IoContract size={18} /> : <IoExpand size={18} />}
                  </button>
                  
                  {/* Minimize Button (for viewers) */}
                  {!selectedScreenShare.isOwn && (
                    <button
                      onClick={() => {
                        closeScreenShareModal();
                        setShowScreenShareNotification(true);
                      }}
                      className="p-2 bg-yellow-600/80 hover:bg-yellow-700/80 text-white rounded-lg transition-colors"
                      title="Minimize - Show notification"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Close Modal */}
                  <button
                    onClick={closeScreenShareModal}
                    className="p-2 bg-red-600/80 hover:bg-red-700/80 text-white rounded-lg transition-colors"
                    title={selectedScreenShare.isOwn ? "Close Screen Share" : "Close Viewer"}
                  >
                    <IoClose size={18} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Video Container */}
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video
                ref={(el) => {
                  if (el && selectedScreenShare.stream && selectedScreenShare.stream.active) {
                    el.srcObject = selectedScreenShare.stream;
                    el.muted = true;
                    el.autoplay = true;
                    el.playsInline = true;
                  }
                }}
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
              <div className="flex items-center justify-center gap-4">
                {selectedScreenShare.isOwn ? (
                  /* Controls for screen sharer */
                  <>
                    {/* Mic Control */}
                    <button
                      onClick={toggleMute}
                      className={`p-3 rounded-full ${
                        isMuted ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                      } text-white transition-all hover:scale-105 shadow-lg`}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? <BsMicMuteFill size={24} /> : <FaMicrophone size={24} />}
                    </button>
                    
                    {/* Camera Control */}
                    <button
                      onClick={toggleVideo}
                      className={`p-3 rounded-full ${
                        isVideoOff ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                      } text-white transition-all hover:scale-105 shadow-lg`}
                      title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                      {isVideoOff ? (
                        <BsFillCameraVideoOffFill size={24} />
                      ) : (
                        <BsFillCameraVideoFill size={24} />
                      )}
                    </button>
                    
                    {/* Stop Screen Share */}
                    <button
                      onClick={() => {
                        handleScreenShare();
                        closeScreenShareModal();
                      }}
                      className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-105 shadow-lg"
                      title="Stop Screen Share"
                    >
                      <HiDesktopComputer size={24} />
                    </button>
                  </>
                ) : (
                  /* Controls for viewers */
                  <>
                    {/* Switch to different screen share if multiple available */}
                    {availableScreenShares.filter(s => !s.isOwn).length > 1 && (
                      <button
                        onClick={() => {
                          const otherShares = availableScreenShares.filter(s => !s.isOwn);
                          const currentIndex = otherShares.findIndex(s => s.peerId === selectedScreenShare.peerId);
                          const nextIndex = (currentIndex + 1) % otherShares.length;
                          openScreenShareModal(otherShares[nextIndex]);
                        }}
                        className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 shadow-lg"
                        title="Switch to next screen share"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    )}
                    
                    {/* Minimize */}
                    <button
                      onClick={() => {
                        closeScreenShareModal();
                        setShowScreenShareNotification(true);
                      }}
                      className="p-3 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white transition-all hover:scale-105 shadow-lg"
                      title="Minimize to notification"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  </>
                )}
                
                {/* Close Modal Button */}
                <button
                  onClick={closeScreenShareModal}
                  className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all hover:scale-105 shadow-lg"
                  title={selectedScreenShare.isOwn ? "Close Your Screen Share" : "Close Viewer"}
                >
                  <IoClose size={24} />
                </button>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="text-white text-sm flex items-center gap-4">
                  <span className={`flex items-center gap-1 ${isMuted ? 'text-red-400' : 'text-green-400'}`}>
                    {isMuted ? <BsMicMuteFill size={14} /> : <FaMicrophone size={14} />}
                    {isMuted ? 'Muted' : 'Mic On'}
                  </span>
                  <span className={`flex items-center gap-1 ${isVideoOff ? 'text-red-400' : 'text-green-400'}`}>
                    {isVideoOff ? <BsFillCameraVideoOffFill size={14} /> : <BsFillCameraVideoFill size={14} />}
                    {isVideoOff ? 'Camera Off' : 'Camera On'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Screen Sharing Display */}
      {screenShareArray.length > 0 && (
        <div className="fixed top-4 left-4 w-[calc(100vw-320px-48px)] h-[50vh] bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-blue-500 mb-2">
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
            <HiDesktopComputer size={12} />
            <span>Screen Share</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full h-full p-2">
            {screenShareArray.map((screenShare, idx) => (
              <div
                key={`screen-${screenShare.peerId}-${idx}`}
                className="relative bg-gray-800 rounded-lg overflow-hidden group cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                onClick={() => openScreenShareModal(screenShare)}
              >
                <video
                  ref={(el) => {
                    if (el && screenShare.stream && screenShare.stream.active) {
                      el.srcObject = screenShare.stream;
                      el.muted = true;
                      el.autoplay = true;
                      el.playsInline = true;
                    }
                  }}
                  className="w-full h-full object-contain bg-black"
                />
                
                {/* Screen Share Label */}
                <div className="absolute bottom-2 left-2 bg-blue-600/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <HiDesktopComputer size={12} />
                  <span>{screenShare.isOwn ? "Your Screen" : `${screenShare.peerId}'s Screen`}</span>
                </div>
                
                {/* Expand Hint */}
                <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <IoExpand size={14} />
                </div>
                
                {/* Close button for own screen share */}
                {screenShare.isOwn && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScreenShare();
                    }}
                    className="absolute top-2 left-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                    title="Stop Screen Share"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Video Call Display */}
      <div className={`fixed top-4 left-4 w-[calc(100vw-320px-48px)] ${screenShareArray.length > 0 ? 'h-[25vh] mt-[52vh]' : 'h-[25vh]'} bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700`}>
        {validStreams.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <p className="text-sm">Waiting for video...</p>
              <p className="text-xs text-gray-400 mt-1">ID: {peerId}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full h-full p-2">
            {validStreams.map((stream, idx) => (
              <div
                key={`${stream.id}-${idx}`}
                className="relative bg-gray-800 rounded-lg overflow-hidden group"
              >
                <video
                  ref={(el) => {
                    if (el && stream && stream.active) {
                      el.srcObject = stream;
                      el.muted = idx === 0; // Mute local stream to avoid feedback
                      el.autoplay = true;
                      el.playsInline = true;
                    }
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Bottom Label */}
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {idx === 0 ? "You" : `User ${idx}`}
                </div>

                {/* Local stream controls */}
                {idx === 0 && (
                  <>
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      LOCAL
                    </div>

                    {/* Hover Controls */}
                    <div className="absolute top-2 right-2 hidden group-hover:flex flex-col gap-2 transition duration-200 ease-in-out">
                      <button
                        onClick={toggleMute}
                        className={`p-2 rounded-full ${
                          isMuted ? "bg-red-600" : "bg-green-600"
                        } text-white hover:scale-105`}
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? <BsMicMuteFill size={18} /> : <FaMicrophone size={18} />}
                      </button>
                      
                      <button
                        onClick={toggleVideo}
                        className={`p-2 rounded-full ${
                          isVideoOff ? "bg-red-600" : "bg-green-600"
                        } text-white hover:scale-105`}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                      >
                        {isVideoOff ? (
                          <BsFillCameraVideoOffFill size={18} />
                        ) : (
                          <BsFillCameraVideoFill size={18} />
                        )}
                      </button>
                      
                      <button
                        onClick={handleScreenShare}
                        className={`p-2 rounded-full ${
                          isScreenSharing ? "bg-blue-600" : "bg-gray-600"
                        } text-white hover:scale-105`}
                        title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                      >
                        <HiDesktopComputer size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status Display */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
            {validStreams.length} participant{validStreams.length !== 1 ? "s" : ""}
            {screenShareArray.length > 0 && ` | ${screenShareArray.length} screen${screenShareArray.length !== 1 ? "s" : ""}`}
          </div>
          {isScreenSharing && (
            <div className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
              🖥️ Sharing
            </div>
          )}
        </div>
      </div>
    </>
  );
};
