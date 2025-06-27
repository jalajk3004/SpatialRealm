"use client";

import { useRoom } from "./useRoomContext";
import { useState } from "react";
import { BsFillCameraVideoFill, BsFillCameraVideoOffFill } from "react-icons/bs";
import { BsMicMuteFill } from "react-icons/bs";
import { FaMicrophone } from "react-icons/fa";

export const Call = () => {
  const { localStream, remoteStreams, isConnected, error, peerId } = useRoom();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

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

  const allStreams = localStream ? [localStream, ...remoteStreams] : remoteStreams;

  return (
    <div className="fixed top-4 left-4 w-[calc(100vw-320px-48px)] h-[25vh] bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      {allStreams.length === 0 ? (
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
          {allStreams.map((stream, idx) => (
            <div
              key={stream.id}
              className="relative bg-gray-800 rounded-lg overflow-hidden group"
            >
              <video
                ref={(el) => {
                  if (el && stream) {
                    el.srcObject = stream;
                    el.muted = idx === 0;
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

              {/* Top Left Label for Local */}
              {idx === 0 && (
                <>
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    LOCAL
                  </div>

                  {/* Hover Controls with Icons */}
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
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {remoteStreams.length + (localStream ? 1 : 0)} participant
        {allStreams.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};
