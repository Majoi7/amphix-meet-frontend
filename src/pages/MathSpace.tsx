import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLocalParticipant } from "@livekit/components-react";
import * as JXG from "jsxgraph";
import { Track } from "livekit-client";

export function MathSpace() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const boardRef = useRef<JXG.Board | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();
  const [isSharing, setIsSharing] = useState(false);
  const [shareStream, setShareStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Initialize JSXGraph board with canvas renderer
    const board = JXG.JSXGraph.initBoard(containerRef.current!, {
      boundingbox: [-5, 5, 5, -5], // Default bounding box
      axis: true,
      showCopyright: false,
      renderer: "canvas", // Use canvas renderer for captureStream
    });

    boardRef.current = board;

    // Example: create a point and a function graph
    board.create('point', [0, 0], { name: 'A' });
    board.create('functiongraph', [function(x: number) { return x * x; }, -5, 5], { strokeColor: 'blue' });

    // Cleanup on unmount
    return () => {
      if (boardRef.current) {
        // Attempt to dispose the board
        (boardRef.current as any).dispose();
        boardRef.current = null;
      }
    };
  }, []);

  const toggleShareScreen = useCallback(async () => {
    if (isSharing) {
      // Stop sharing
      if (shareStream) {
        shareStream.getTracks().forEach(track => track.stop());
        setShareStream(null);
      }
      setIsSharing(false);
    } else {
      // Start sharing
      try {
        const canvas = containerRef.current?.querySelector('canvas');
        if (!canvas) {
          console.error('No canvas available for capture');
          return;
        }
        const stream = canvas.captureStream(30);
        if (!stream) {
          console.error('No stream from canvas');
          return;
        }
        const track = stream.getVideoTracks()[0];
        if (!track) {
          console.error('No video track from canvas');
          return;
        }
        // Publish the track
        await localParticipant?.publishTrack(track, {
          source: Track.Source.ScreenShare,
          name: 'mathspace'
        });
        setShareStream(stream);
        setIsSharing(true);
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  }, [isSharing, shareStream, localParticipant]);

  useEffect(() => {
    return () => {
      if (shareStream) {
        shareStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [shareStream]);

  const handleBackToRoom = () => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between p-4 bg-meet-border">
        <h1 className="text-xl font-bold">Math Space</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleBackToRoom}
            className="flex h-8 w-8 items-center justify-center rounded-full text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5a.5.5 0 0 0 .5-.5z"/>
            </svg>
          </button>
          {localParticipant && (
            <button
              onClick={toggleShareScreen}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isSharing
                  ? "bg-meet-red text-meet-bg"
                  : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
              }`}
            >
              {isSharing ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-1.5-1.72-2.641-3.238l-1.708 1.708c1.169 1.169 1.897 2.694 1.897 4.293 0 .822-.066 1.641-.198 2.43l1.387 1.387c.215-.137.43-.248.619-.33zM6.071 6.641C4.37 8.135 3.5 9.802 3.5 11.5a2.5 2.5 0 0 0 5 0c0-1.69-.87-3.365-2.429-4.859l1.708-1.708c1.023 1.023 2.044 1.663 3.238 1.663a4.5 4.5 0 0 1 2.582-.559l-.778.778A5.949 5.949 0 0 0 12 9.5a5.949 5.949 0 0 0-3.471-2.06l-.778.778a4.5 4.5 0 0 1-.559 2.582z"/>
                    <path d="M11.296 2.704l-1.708-1.708c1.023-1.023 2.044-1.663 3.238-1.663a4.5 4.5 0 0 1 2.582.559l.778.778A5.949 5.949 0 0 0 12 6.5a5.949 5.949 0 0 0-3.471 2.06l.778-.778a4.5 4.5 0 0 1 .559-2.582zM6.641 6.071c1.169-1.169 1.897-2.694 1.897-4.293 0-.822-.066-1.641-.198-2.43l-1.387-1.387c.215.137.43.248.619.33z"/>
                  </svg>
                  <span className="ml-1">Partager les maths</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.507A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C16.566 8.23 14.902 10.07 8 11.073C1.098 10.07-.566 8.23 1.173 8z"/>
                  </svg>
                  <span className="ml-1">Arrêter le partage</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}