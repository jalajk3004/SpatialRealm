"use client";

import React from 'react';

export interface FileInfo {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

interface FileAttachmentProps {
  file: FileInfo;
  sender: string;
  isOwn: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ file, sender, isOwn }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📑';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️';
    if (type === 'text/plain') return '📄';
    return '📎';
  };

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = () => {
    window.open(file.url, '_blank');
  };

  return (
    <div 
      className={`max-w-[280px] rounded-lg border p-3 ${
        isOwn 
          ? 'bg-blue-500 text-white border-blue-600' 
          : 'bg-gray-100 text-gray-800 border-gray-200'
      }`}
    >
      {/* File preview for images */}
      {isImage && (
        <div className="mb-2">
          <img 
            src={file.url} 
            alt={file.originalName}
            className="max-w-full max-h-40 rounded cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handlePreview}
          />
        </div>
      )}

      {/* File preview for videos */}
      {isVideo && (
        <div className="mb-2">
          <video 
            src={file.url}
            controls
            className="max-w-full max-h-40 rounded"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* File info */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{getFileIcon(file.type)}</span>
        <div className="flex-1 min-w-0">
          <div 
            className={`font-medium text-sm truncate cursor-pointer hover:underline ${
              isOwn ? 'text-white' : 'text-gray-800'
            }`}
            onClick={handlePreview}
            title={file.originalName}
          >
            {file.originalName}
          </div>
          <div className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
            {formatFileSize(file.size)}
          </div>
        </div>
        <button
          onClick={handleDownload}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            isOwn 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
          title="Download file"
        >
          ⬇️
        </button>
      </div>
    </div>
  );
};
